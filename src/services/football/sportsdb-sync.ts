import { db } from '@/database/client';
import { slugify } from '@/lib/format';
import { log } from '@/lib/logger';
import type { Player, Team } from '@/types/football';
import { currentSeason } from './openfootball-sync';
import { bindIdentity } from './identities';
import { stableEntityId } from './stable-identity';
import { footballJob } from './jobs';
import { readLocalDataset } from './local-store';
import { SportsDbProvider, sportsDbPosition, sportsDbTeamMatches } from './providers/thesportsdb';
import { wikimediaPhotos } from './providers/wikimedia-photo';

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
function validHeight(value: string | null | undefined) {
  const metric = value?.match(/\b(?:1\.\d{2}|2\.\d{2})\s*m\b|\b\d{3}\s*cm\b/i)?.[0];
  return metric?.replace(/\s+/g, ' ');
}
function preferredFoot(value: string | null | undefined) {
  if (/^right$/i.test(value ?? '')) return 'Droit';
  if (/^left$/i.test(value ?? '')) return 'Gauche';
  if (/^(both|either)$/i.test(value ?? '')) return 'Les deux';
  return undefined;
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
      select: { key: true, expiresAt: true, payload: true },
    });
    const cacheByKey = new Map(cached.map((entry) => [entry.key, entry]));
    const eligible = active
      .filter((team) => {
        const cachedTeam = cacheByKey.get(cacheKey(team.id));
        const payload = cachedTeam?.payload as { status?: string; version?: number } | undefined;
        return (
          (cachedTeam?.expiresAt.getTime() ?? 0) <= now ||
          (payload?.status === 'partial' && payload.version !== 2)
        );
      })
      .filter(
        (team) =>
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
        const photos = await wikimediaPhotos(valid.flatMap((row) => row.idWikidata ?? [])).catch(
          () => new Map(),
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
        const knownPlayers = new Map(
          (
            await db.footballIdentity.findMany({
              where: {
                provider: 'thesportsdb',
                kind: 'player',
                externalId: { in: valid.map((row) => row.idPlayer) },
              },
              select: { externalId: true, entityId: true },
            })
          ).map((row) => [row.externalId, row.entityId]),
        );
        const newPlayerIdentities: {
          provider: string;
          kind: string;
          externalId: string;
          externalName: string;
          entityId: string;
        }[] = [];
        const next: Player[] = [];
        for (const row of valid) {
          const id =
            knownPlayers.get(row.idPlayer) ?? stableEntityId('thesportsdb', 'player', row.idPlayer);
          if (!knownPlayers.has(row.idPlayer)) {
            knownPlayers.set(row.idPlayer, id);
            newPlayerIdentities.push({
              provider: 'thesportsdb',
              kind: 'player',
              externalId: row.idPlayer,
              externalName: row.strPlayer,
              entityId: id,
            });
          }
          const old = data.players.find((player) => player.id === id);
          const licensedPhoto = row.idWikidata ? photos.get(row.idWikidata) : undefined;
          const player: Player = {
            id,
            slug: old?.slug ?? `${slugify(row.strPlayer)}-${id.slice(0, 8)}`,
            name: row.strPlayer,
            teamId: team.id,
            position: sportsDbPosition(row.strPosition)!,
            number: /^\d{1,2}$/.test(row.strNumber ?? '') ? Number(row.strNumber) : null,
            nationality: row.strNationality ?? undefined,
            birthDate: validBirthDate(row.dateBorn),
            height: validHeight(row.strHeight),
            foot: preferredFoot(row.strSide),
            photo: licensedPhoto?.photo ?? old?.photo,
            photoCredit: licensedPhoto?.photoCredit ?? old?.photoCredit,
            photoSource: licensedPhoto?.photoSource ?? old?.photoSource,
            photoLicense: licensedPhoto?.photoLicense ?? old?.photoLicense,
            photoLicenseUrl: licensedPhoto?.photoLicenseUrl ?? old?.photoLicenseUrl,
            updatedAt: new Date().toISOString(),
            source: 'thesportsdb',
            stats: emptyStats,
          };
          next.push(player);
        }
        if (newPlayerIdentities.length)
          await db.footballIdentity.createMany({ data: newPlayerIdentities, skipDuplicates: true });
        for (let offset = 0; offset < next.length; offset += 12)
          await Promise.all(
            next.slice(offset, offset + 12).map((player) =>
              db.player.upsert({
                where: { id: player.id },
                create: {
                  id: player.id,
                  slug: player.slug,
                  name: player.name,
                  teamId: team.id,
                  position: player.position,
                  number: player.number,
                  nationality: player.nationality,
                  photo: player.photo,
                  birthDate: player.birthDate ? new Date(player.birthDate) : null,
                },
                update: {
                  name: player.name,
                  teamId: team.id,
                  position: player.position,
                  number: player.number,
                  nationality: player.nationality,
                  photo: player.photo,
                  birthDate: player.birthDate ? new Date(player.birthDate) : null,
                },
              }),
            ),
          );
        for (let offset = 0; offset < next.length; offset += 12)
          await Promise.all(
            next.slice(offset, offset + 12).map((player) =>
              db.searchIndex.upsert({
                where: { id: `player:${player.id}` },
                create: {
                  id: `player:${player.id}`,
                  entityType: 'player',
                  entityId: player.id,
                  title: player.name,
                  normalized: slugify(player.name),
                  href: `/joueur/${player.slug}`,
                },
                update: {
                  title: player.name,
                  normalized: slugify(player.name),
                  href: `/joueur/${player.slug}`,
                },
              }),
            ),
          );
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
            payload: { status: 'partial', count: team.count, version: 2 },
            expiresAt: new Date(now + 4 * 86400_000),
            staleUntil: new Date(now + 8 * 86400_000),
          },
          update: {
            payload: { status: 'partial', count: team.count, version: 2 },
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
