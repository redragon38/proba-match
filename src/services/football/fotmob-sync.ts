import { db } from '@/database/client';
import { log } from '@/lib/logger';
import type { Match, MatchStat } from '@/types/football';
import { bindIdentity } from './identities';
import { footballJob } from './jobs';
import { readLocalDataset } from './local-store';
import { persistMatchDetails } from './persistence';
import { FotmobProvider, identifyFotmobMatch } from './providers/fotmob';

const normalized = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

function mergeStatistics(current: MatchStat[], advanced: MatchStat[]) {
  const rows = new Map(current.map((row) => [row.label, row]));
  for (const row of advanced) rows.set(row.label, row);
  return [...rows.values()];
}

/** Enrich a small rotating batch. A match is accepted only when date, score and both teams agree. */
export async function syncFotmobAdvancedDetails(limit = 3) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 5) throw new Error('INVALID_BATCH_LIMIT');
  return footballJob('fotmob-details', async () => {
    const data = await readLocalDataset();
    const provider = new FotmobProvider();
    const alreadyMapped = new Map(
      (
        await db.footballIdentity.findMany({
          where: { provider: 'fotmob', kind: 'match' },
          select: { externalId: true, entityId: true },
        })
      ).map((row) => [row.entityId, row.externalId]),
    );
    const recentAttempts = new Map(
      (
        await db.dataSource.findMany({
          where: { id: { startsWith: 'fotmob:attempt:' } },
          select: { id: true, lastSyncedAt: true },
        })
      ).map((row) => [row.id.slice('fotmob:attempt:'.length), row.lastSyncedAt?.getTime() ?? 0]),
    );
    const selected = data.matches
      .filter(
        (match) =>
          match.status === 'finished' &&
          match.lineups.length === 2 &&
          Date.now() - (recentAttempts.get(match.id) ?? 0) > 7 * 86400_000 &&
          !match.statistics.some(
            (row) => row.label === 'xG' && row.home != null && row.away != null,
          ),
      )
      .sort((a, b) => b.kickoff.localeCompare(a.kickoff))
      .slice(0, limit);
    const daily = new Map<string, Awaited<ReturnType<FotmobProvider['matches']>>>();
    const changed = new Set<string>();
    const profileIds = new Set<string>();
    let unmatched = 0,
      failures = 0;
    for (const match of selected) {
      try {
        const home = data.teams.find((team) => team.id === match.homeId);
        const away = data.teams.find((team) => team.id === match.awayId);
        if (!home || !away) throw new Error('FOTMOB_MISSING_TEAMS');
        let externalId = alreadyMapped.get(match.id);
        if (!externalId) {
          const date = match.kickoff.slice(0, 10).replaceAll('-', '');
          let rows = daily.get(date);
          if (!rows) {
            rows = await provider.matches(date);
            daily.set(date, rows);
          }
          const identified = identifyFotmobMatch(rows, {
            kickoff: match.kickoff,
            homeName: home.name,
            awayName: away.name,
            homeScore: match.homeScore,
            awayScore: match.awayScore,
          });
          if (!identified) {
            unmatched++;
            await db.dataSource.upsert({
              where: { id: `fotmob:attempt:${match.id}` },
              create: {
                id: `fotmob:attempt:${match.id}`,
                url: `https://www.fotmob.com/api/data/matches?date=${date}`,
                license: 'FotMob data; FotMob terms apply',
                lastSyncedAt: new Date(),
                payload: { outcome: 'unmatched' },
              },
              update: { lastSyncedAt: new Date(), payload: { outcome: 'unmatched' } },
            });
            continue;
          }
          externalId = String(identified.id);
          await bindIdentity(
            'fotmob',
            'match',
            externalId,
            match.id,
            `${home.name} / ${away.name}`,
          );
          await bindIdentity(
            'fotmob',
            'team',
            String(identified.home.id),
            home.id,
            identified.home.name,
          );
          await bindIdentity(
            'fotmob',
            'team',
            String(identified.away.id),
            away.id,
            identified.away.name,
          );
        }
        const details = await provider.details(externalId);
        if (details.matchId !== externalId) throw new Error('FOTMOB_MATCH_SCOPE_MISMATCH');
        const externalTeams = new Map([
          [String(details.teams[0].id), match.homeId],
          [String(details.teams[1].id), match.awayId],
        ]);
        const performances = (match.performances ?? []).map((performance) => ({ ...performance }));
        for (const player of details.players) {
          const teamId = externalTeams.get(player.teamExternalId);
          if (!teamId) continue;
          const candidates = performances.filter(
            (row) => row.teamId === teamId && normalized(row.name) === normalized(player.name),
          );
          if (candidates.length !== 1) continue;
          const target = candidates[0];
          await bindIdentity('fotmob', 'player', player.externalId, target.playerId, player.name);
          target.stats = { ...target.stats, ...player.stats };
          profileIds.add(target.playerId);
        }
        const observedAt = new Date().toISOString();
        const merged: Match = {
          ...match,
          statistics: mergeStatistics(match.statistics, details.statistics),
          performances,
          detailsUpdatedAt: observedAt,
          detailSource: { ...match.detailSource, statistics: 'fotmob' },
          detailPresence: { ...match.detailPresence, statistics: true },
          detailObservedAt: { ...match.detailObservedAt, statistics: observedAt },
        };
        data.matches[data.matches.indexOf(match)] = merged;
        changed.add(match.id);
        await db.dataSource.upsert({
          where: { id: `fotmob:match:${externalId}` },
          create: {
            id: `fotmob:match:${externalId}`,
            url: `https://www.fotmob.com/api/data/matchDetails?matchId=${externalId}`,
            license: 'FotMob data; FotMob terms apply',
            lastSyncedAt: new Date(),
            payload: { matchId: match.id, statistics: details.statistics.map((row) => row.label) },
          },
          update: {
            lastSyncedAt: new Date(),
            payload: { matchId: match.id, statistics: details.statistics.map((row) => row.label) },
          },
        });
      } catch (error) {
        failures++;
        log('FOTMOB_DETAILS_FAILED', {
          code:
            error instanceof Error && /^[A-Z_0-9]+$/.test(error.message)
              ? error.message
              : 'INVALID_SOURCE_DATA',
        });
      }
    }
    if (changed.size) {
      data.updatedAt = new Date().toISOString();
      await persistMatchDetails(data, changed, profileIds);
    }
    return {
      status: failures ? 'partial' : 'success',
      matches: changed.size,
      selected: selected.length,
      players: profileIds.size,
      requests: provider.requests,
      unmatched,
      failures,
    };
  });
}
