import { db } from '@/database/client';
import { slugify } from '@/lib/format';
import { log } from '@/lib/logger';
import type { Player, Team } from '@/types/football';
import { currentSeason } from './openfootball-sync';
import { bindIdentity, resolveIdentity } from './identities';
import { footballJob } from './jobs';
import { readLocalDataset } from './local-store';
import { SportsDbProvider, sportsDbPosition, sportsDbTeamMatches } from './providers/thesportsdb';

const cacheKey = (id: string) => `thesportsdb:team:${id}`;
const emptyStats: Player['stats'] = {
  appearances: null,
  starts: null,
  minutes: null,
  goals: null,
  assists: null,
  rating: null,
};
function validBirthDate(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
    ? value
    : undefined;
}

function interleaveTeams(teams: Team[]) {
  const groups = new Map<string, Team[]>();
  for (const team of teams)
    groups.set(team.competitionId, [...(groups.get(team.competitionId) ?? []), team]);
  const ordered: Team[] = [];
  while ([...groups.values()].some((group) => group.length))
    for (const group of groups.values()) {
      const team = group.shift();
      if (team) ordered.push(team);
    }
  return ordered;
}

/** A bounded, server-only roster fallback. Never turn the provider's ten-player sample into a claimed full squad. */
export async function syncSportsDbPlayers(limit = 30) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 30) throw new Error('INVALID_BATCH_LIMIT');
  return footballJob('thesportsdb', async () => {
    const data = await readLocalDataset();
    const activeIds = new Set(
      data.matches
        .filter((match) => match.season === currentSeason())
        .flatMap((match) => [match.homeId, match.awayId]),
    );
    if (!activeIds.size) return { status: 'awaiting_openfootball', players: 0, requests: 0 };
    const now = Date.now();
    const active = data.teams.filter((team) => activeIds.has(team.id));
    const cached = await db.cacheEntry.findMany({
      where: { key: { in: active.map((team) => cacheKey(team.id)) } },
      select: { key: true, expiresAt: true },
    });
    const cacheByKey = new Map(cached.map((entry) => [entry.key, entry.expiresAt.getTime()]));
    const eligible = active.filter(
      (team) =>
        (cacheByKey.get(cacheKey(team.id)) ?? 0) <= now &&
        !data.players.some(
          (player) => player.teamId === team.id && player.source !== 'thesportsdb',
        ),
    );
    // Cover each supported league early, and fill never-seen clubs before refreshing old ones.
    const selected = [
      ...interleaveTeams(eligible.filter((team) => !cacheByKey.has(cacheKey(team.id)))),
      ...interleaveTeams(eligible.filter((team) => cacheByKey.has(cacheKey(team.id)))),
    ].slice(0, limit);
    const provider = new SportsDbProvider();
    let imported = 0;
    let failures = 0;
    const completed: { id: string; count: number }[] = [];
    for (const team of selected) {
      try {
        const known = await db.footballIdentity.findFirst({
          where: { provider: 'thesportsdb', kind: 'team', entityId: team.id },
        });
        const external = known ? { idTeam: known.externalId } : await provider.team(team.name);
        if (
          !external ||
          (!known && 'strTeam' in external && !sportsDbTeamMatches(team, external))
        ) {
          await db.cacheEntry.upsert({
            where: { key: cacheKey(team.id) },
            create: {
              key: cacheKey(team.id),
              payload: { status: 'unmapped' },
              expiresAt: new Date(now + 86400_000),
              staleUntil: new Date(now + 86400_000),
            },
            update: {
              payload: { status: 'unmapped' },
              expiresAt: new Date(now + 86400_000),
              staleUntil: new Date(now + 86400_000),
            },
          });
          continue;
        }
        if (!known) await bindIdentity('thesportsdb', 'team', external.idTeam, team.id, team.name);
        const rows = await provider.players(external.idTeam);
        const valid = rows.filter(
          (row) => row.idTeam === external.idTeam && sportsDbPosition(row.strPosition),
        );
        if (!valid.length) {
          await db.cacheEntry.upsert({
            where: { key: cacheKey(team.id) },
            create: {
              key: cacheKey(team.id),
              payload: { status: 'empty' },
              expiresAt: new Date(now + 86400_000),
              staleUntil: new Date(now + 86400_000),
            },
            update: {
              payload: { status: 'empty' },
              expiresAt: new Date(now + 86400_000),
              staleUntil: new Date(now + 86400_000),
            },
          });
          continue;
        }
        const next: Player[] = [];
        for (const row of valid) {
          const id = await resolveIdentity(
            'thesportsdb',
            'player',
            row.idPlayer,
            row.strPlayer,
            [],
          );
          const old = data.players.find((player) => player.id === id);
          const player: Player = {
            id,
            slug: old?.slug ?? `${slugify(row.strPlayer)}-${id.slice(0, 8)}`,
            name: row.strPlayer,
            teamId: team.id,
            position: sportsDbPosition(row.strPosition)!,
            number: /^\d{1,2}$/.test(row.strNumber ?? '') ? Number(row.strNumber) : null,
            nationality: row.strNationality ?? undefined,
            birthDate: validBirthDate(row.dateBorn),
            updatedAt: new Date().toISOString(),
            source: 'thesportsdb',
            stats: emptyStats,
          };
          next.push(player);
          await db.player.upsert({
            where: { id },
            create: {
              id,
              slug: player.slug,
              name: player.name,
              teamId: team.id,
              position: player.position,
              number: player.number,
              nationality: player.nationality,
              birthDate: player.birthDate ? new Date(player.birthDate) : null,
            },
            update: {
              name: player.name,
              teamId: team.id,
              position: player.position,
              number: player.number,
              nationality: player.nationality,
              birthDate: player.birthDate ? new Date(player.birthDate) : null,
            },
          });
          await db.searchIndex.upsert({
            where: { id: `player:${id}` },
            create: {
              id: `player:${id}`,
              entityType: 'player',
              entityId: id,
              title: player.name,
              normalized: slugify(player.name),
              href: `/joueur/${player.slug}`,
            },
            update: {
              title: player.name,
              normalized: slugify(player.name),
              href: `/joueur/${player.slug}`,
            },
          });
        }
        const removed = data.players.filter(
          (player) =>
            player.teamId === team.id &&
            player.source === 'thesportsdb' &&
            !next.some((p) => p.id === player.id),
        );
        if (removed.length)
          await db.searchIndex.deleteMany({
            where: { id: { in: removed.map((player) => `player:${player.id}`) } },
          });
        const nextIds = new Set(next.map((player) => player.id));
        data.players = [
          ...data.players.filter(
            (player) =>
              !nextIds.has(player.id) &&
              (player.teamId !== team.id || player.source !== 'thesportsdb'),
          ),
          ...next,
        ];
        imported += next.length;
        completed.push({ id: team.id, count: next.length });
      } catch (error) {
        failures++;
        log('SPORTSDB_TEAM_SYNC_FAILED', {
          code:
            error instanceof Error && /^[A-Z_]+$/.test(error.message)
              ? error.message
              : 'INVALID_SOURCE_DATA',
        });
        if (error instanceof Error && error.message === 'SPORTSDB_RATE_LIMIT') break;
      }
    }
    if (imported) {
      data.players.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
      await db.cacheEntry.update({
        where: { key: 'football:dataset' },
        data: { payload: JSON.parse(JSON.stringify(data)) },
      });
      for (const team of completed)
        await db.cacheEntry.upsert({
          where: { key: cacheKey(team.id) },
          create: {
            key: cacheKey(team.id),
            payload: { status: 'partial', count: team.count },
            expiresAt: new Date(now + 4 * 86400_000),
            staleUntil: new Date(now + 8 * 86400_000),
          },
          update: {
            payload: { status: 'partial', count: team.count },
            expiresAt: new Date(now + 4 * 86400_000),
            staleUntil: new Date(now + 8 * 86400_000),
          },
        });
      await db.dataSource.upsert({
        where: { id: 'thesportsdb:players' },
        create: {
          id: 'thesportsdb:players',
          url: 'https://www.thesportsdb.com/documentation',
          license: 'TheSportsDB API Terms of Use',
          lastSyncedAt: new Date(),
        },
        update: { lastSyncedAt: new Date() },
      });
    }
    log('SPORTSDB_PLAYERS_SYNC_FINISHED', { count: imported });
    return {
      status: failures ? 'partial' : 'success',
      players: imported,
      requests: provider.requests,
      teams: selected.length,
      failures,
    };
  });
}
