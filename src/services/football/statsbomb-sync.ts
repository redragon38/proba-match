import { db } from '@/database/client';
import { log } from '@/lib/logger';
import type { Match, MatchStat } from '@/types/football';
import { bindIdentity } from './identities';
import { footballJob } from './jobs';
import { readLocalDataset } from './local-store';
import { persistMatchDetails } from './persistence';
import { StatsbombProvider, type StatsbombMatch } from './providers/statsbomb';

const normalized = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(fc|cf|sc|afc|club|football|calcio)\b/g, '')
    .replace(/[^a-z0-9]/g, '');

const competitionName = (value: string) => normalized(value).replace(/^1bundesliga$/, 'bundesliga');

function mergeStatistics(current: MatchStat[], advanced: MatchStat[]) {
  const rows = new Map(current.map((row) => [row.label, row]));
  for (const row of advanced) rows.set(row.label, row);
  return [...rows.values()];
}

function identify(rows: StatsbombMatch[], expected: Match, homeName: string, awayName: string) {
  const date = expected.kickoff.slice(0, 10);
  const candidates = rows.filter(
    (row) =>
      row.match_date === date &&
      row.home_score === expected.homeScore &&
      row.away_score === expected.awayScore &&
      normalized(row.home_team.home_team_name ?? '') === normalized(homeName) &&
      normalized(row.away_team.away_team_name ?? '') === normalized(awayName),
  );
  return candidates.length === 1 ? candidates[0] : null;
}

export async function syncStatsbombAdvancedDetails(limit = 3) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 5) throw new Error('INVALID_BATCH_LIMIT');
  return footballJob('statsbomb-details', async () => {
    const data = await readLocalDataset();
    const provider = new StatsbombProvider();
    const competitions = await provider.competitions();
    const competitionById = new Map(data.competitions.map((row) => [row.id, row]));
    const teams = new Map(data.teams.map((row) => [row.id, row]));
    const candidates = data.matches.filter(
      (match) =>
        match.status === 'finished' &&
        !match.statistics.some((row) => ['PPDA', 'Field tilt', 'xT'].includes(row.label)),
    );
    const selected: { match: Match; providerMatch: StatsbombMatch }[] = [];
    const scopes = new Map<string, typeof candidates>();
    for (const match of candidates) {
      const competition = competitionById.get(match.competitionId);
      const season = match.season ?? Number(match.kickoff.slice(0, 4));
      if (!competition || !Number.isSafeInteger(season)) continue;
      const scope = competitions.find(
        (row) =>
          competitionName(row.competition_name) === competitionName(competition.name) &&
          Number(row.season_name.slice(0, 4)) === season,
      );
      if (!scope) continue;
      const key = `${scope.competition_id}:${scope.season_id}`;
      scopes.set(key, [...(scopes.get(key) ?? []), match]);
    }
    for (const [key, matches] of scopes) {
      if (selected.length >= limit) break;
      const [competitionId, seasonId] = key.split(':').map(Number);
      const rows = await provider.matches(competitionId, seasonId);
      for (const match of matches) {
        const home = teams.get(match.homeId),
          away = teams.get(match.awayId);
        if (!home || !away) continue;
        const providerMatch = identify(rows, match, home.name, away.name);
        if (providerMatch) selected.push({ match, providerMatch });
        if (selected.length >= limit) break;
      }
    }
    const changed = new Set<string>();
    let failures = 0;
    for (const { match, providerMatch } of selected) {
      try {
        const statistics = await provider.metrics(providerMatch);
        if (!statistics.some((row) => row.label === 'PPDA'))
          throw new Error('STATSBOMB_METRICS_UNAVAILABLE');
        const externalId = String(providerMatch.match_id);
        await bindIdentity('statsbomb', 'match', externalId, match.id);
        await bindIdentity(
          'statsbomb',
          'team',
          String(providerMatch.home_team.home_team_id),
          match.homeId,
          providerMatch.home_team.home_team_name,
        );
        await bindIdentity(
          'statsbomb',
          'team',
          String(providerMatch.away_team.away_team_id),
          match.awayId,
          providerMatch.away_team.away_team_name,
        );
        const observedAt = new Date().toISOString();
        data.matches[data.matches.indexOf(match)] = {
          ...match,
          statistics: mergeStatistics(match.statistics, statistics),
          detailsUpdatedAt: observedAt,
          detailSource: { ...match.detailSource, statistics: 'statsbomb' },
          detailPresence: { ...match.detailPresence, statistics: true },
          detailObservedAt: { ...match.detailObservedAt, statistics: observedAt },
        };
        changed.add(match.id);
        await db.dataSource.upsert({
          where: { id: `statsbomb:match:${externalId}` },
          create: {
            id: `statsbomb:match:${externalId}`,
            url: `https://github.com/statsbomb/open-data/blob/master/data/events/${externalId}.json`,
            license: 'StatsBomb Open Data; attribution required',
            lastSyncedAt: new Date(),
            payload: {
              matchId: match.id,
              metrics: statistics.map((row) => ({ ...row, unit: row.unit ?? null })),
              xtModel: 'Karun Singh open_xt_12x8_v1',
            },
          },
          update: {
            lastSyncedAt: new Date(),
            payload: {
              matchId: match.id,
              metrics: statistics.map((row) => ({ ...row, unit: row.unit ?? null })),
            },
          },
        });
      } catch (error) {
        failures++;
        log('STATSBOMB_DETAILS_FAILED', {
          code:
            error instanceof Error && /^[A-Z_0-9]+$/.test(error.message)
              ? error.message
              : 'INVALID_SOURCE_DATA',
        });
      }
    }
    if (changed.size) {
      data.updatedAt = new Date().toISOString();
      await persistMatchDetails(data, changed, new Set());
    }
    return {
      status: failures ? 'partial' : 'success',
      matches: changed.size,
      selected: selected.length,
      requests: provider.requests,
      failures,
    };
  });
}
