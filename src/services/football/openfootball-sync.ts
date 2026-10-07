import { db } from '@/database/client';
import { log } from '@/lib/logger';
import { slugify } from '@/lib/format';
import type { Dataset, Match, Team } from '@/types/football';
import {
  OpenFootballProvider,
  OPEN_LEAGUES,
  canonicalTeam,
  type OpenLeague,
} from './providers/openfootball';
import { bindIdentity, identity, resolveIdentity } from './identities';
import { footballJob } from './jobs';
import { readLocalDataset, readLocalHistory } from './local-store';
import { persistDataset } from './persistence';
import { derivedStandings } from '@/services/derived-standings';
import { persistPredictions } from '@/services/predictions';
import { rebuildElo } from './rebuild-elo';
import { stableEntityId } from './stable-identity';

export function currentSeason(now = new Date()) {
  return now.getUTCFullYear() - (now.getUTCMonth() < 6 ? 1 : 0);
}
export function openScopes(history = false) {
  const year = currentSeason();
  const leagues = (process.env.OPENFOOTBALL_LEAGUES ?? 'fr.1,en.1,de.1,es.1,it.1').split(',');
  if (leagues.some((l) => !(l in OPEN_LEAGUES))) throw new Error('INVALID_OPENFOOTBALL_LEAGUE');
  const years = history ? [year - 3, year - 2, year - 1, year] : [year];
  return years.flatMap((season) =>
    leagues.map((league) => ({ league: league as OpenLeague, season })),
  );
}
/** Preserve confirmed secondary fields; a static source must never demote live data. */
export function mergeOpenMatch(previous: Match | undefined, incoming: Match): Match {
  if (!previous) return incoming;
  const secondary = previous.source === 'api-football';
  const confirmed = previous.status === 'live' || previous.status === 'finished';
  return {
    ...previous,
    ...incoming,
    ...(secondary && confirmed
      ? {
          kickoff: previous.kickoff,
          kickoffKnown: previous.kickoffKnown,
          status: previous.status,
          phase: previous.phase,
          minute: previous.minute,
          extra: previous.extra,
          homeScore: previous.homeScore,
          awayScore: previous.awayScore,
          source: previous.source,
        }
      : {}),
    events: previous.events,
    lineups: previous.lineups,
    statistics: previous.statistics,
    performances: previous.performances,
    detailsUpdatedAt: previous.detailsUpdatedAt,
    provenance: { schedule: 'openfootball', details: previous.provenance?.details },
  };
}
export async function syncOpenFootball(
  options: {
    history?: boolean;
    scopes?: { league: OpenLeague; season: number }[];
    force?: boolean;
  } = {},
) {
  return footballJob('openfootball', async () => {
    log('OPENFOOTBALL_IMPORT_STARTED');
    const initialReadAt = Date.now();
    let data = await readLocalDataset();
    log('OPENFOOTBALL_CACHE_READ', { durationMs: Date.now() - initialReadAt });
    // The relational corpus, rather than a truncated display snapshot, feeds the import/model.
    const historyReadAt = Date.now();
    data.matches = await readLocalHistory();
    log('OPENFOOTBALL_HISTORY_READ', {
      durationMs: Date.now() - historyReadAt,
      count: data.matches.length,
    });
    const provider = new OpenFootballProvider();
    let imported = 0,
      requests = 0,
      failures = 0;
    let added = 0,
      changed = 0,
      resultsChanged = 0,
      unchangedSources = 0,
      skippedSources = 0;
    for (const scope of options.scopes ?? openScopes(options.history)) {
      const key = `openfootball:${scope.league}:${scope.season}`;
      const prior = await db.dataSource.findUnique({ where: { id: key } });
      const ttl = scope.season < currentSeason() ? 30 * 86400_000 : 6 * 3600_000;
      if (
        !options.force &&
        prior?.lastSyncedAt &&
        Date.now() - prior.lastSyncedAt.getTime() < ttl
      ) {
        skippedSources++;
        continue;
      }
      try {
        requests++;
        const response = await provider.season(scope.league, scope.season, prior?.etag);
        if (response.unchanged) {
          unchangedSources++;
          await db.dataSource.update({ where: { id: key }, data: { lastSyncedAt: new Date() } });
          continue;
        }
        const batch = response.data;
        const secondaryCompetition = await identity(
          'api-football',
          'competition',
          batch.config.secondaryId,
        );
        const competitionId = await resolveIdentity(
          'openfootball',
          'competition',
          scope.league,
          batch.config.name,
          secondaryCompetition
            ? [secondaryCompetition.entityId]
            : data.competitions
                .filter(
                  (c) =>
                    slugify(c.name) === slugify(batch.config.name) &&
                    c.country === batch.config.country,
                )
                .map((c) => c.id),
        );
        await bindIdentity('api-football', 'competition', batch.config.secondaryId, competitionId);
        const existingCompetition = data.competitions.find((c) => c.id === competitionId);
        const competition = {
          id: competitionId,
          slug: existingCompetition?.slug ?? slugify(batch.config.name),
          name: batch.config.name,
          country: batch.config.country,
          flag: scope.league.slice(0, 2).toUpperCase(),
          season: scope.season,
        };
        const teams: Team[] = [];
        const teamIds = new Map<string, string>();
        for (const [teamKey, name] of new Map(
          batch.matches.flatMap(
            (m) =>
              [
                [m.homeKey, m.homeName],
                [m.awayKey, m.awayName],
              ] as [string, string][],
          ),
        )) {
          const externalId = `${scope.league.slice(0, 2)}:${teamKey}`;
          const candidates = data.teams.filter(
            (t) => t.country === batch.config.country && canonicalTeam(t.name) === teamKey,
          );
          const id = await resolveIdentity(
            'openfootball',
            'team',
            externalId,
            name,
            candidates.map((t) => t.id),
          );
          teamIds.set(teamKey, id);
          const old = data.teams.find((t) => t.id === id);
          teams.push(
            old
              ? { ...old, competitionId }
              : {
                  id,
                  name,
                  slug: `${slugify(name)}-${id.slice(0, 8)}`,
                  short: name.slice(0, 3).toUpperCase(),
                  color: '#365e6d',
                  country: batch.config.country,
                  competitionId,
                },
          );
        }
        const matches: Match[] = [];
        const knownMatchIds = new Map(
          (
            await db.footballIdentity.findMany({
              where: {
                provider: 'openfootball',
                kind: 'match',
                externalId: { in: batch.matches.map((row) => row.externalId) },
              },
              select: { externalId: true, entityId: true },
            })
          ).map((row) => [row.externalId, row.entityId]),
        );
        const newMatchIdentities: {
          provider: string;
          kind: string;
          externalId: string;
          externalName: string;
          entityId: string;
        }[] = [];
        for (const row of batch.matches) {
          const homeId = teamIds.get(row.homeKey)!,
            awayId = teamIds.get(row.awayKey)!;
          const candidates = data.matches.filter(
            (m) =>
              m.competitionId === competitionId &&
              (m.season ?? existingCompetition?.season) === scope.season &&
              m.homeId === homeId &&
              m.awayId === awayId,
          );
          const existingId = knownMatchIds.get(row.externalId);
          const id =
            existingId ??
            (candidates.length > 1
              ? await resolveIdentity(
                  'openfootball',
                  'match',
                  row.externalId,
                  `${row.homeName} / ${row.awayName}`,
                  candidates.map((m) => m.id),
                )
              : (candidates[0]?.id ?? stableEntityId('openfootball', 'match', row.externalId)));
          if (!existingId && candidates.length <= 1)
            newMatchIdentities.push({
              provider: 'openfootball',
              kind: 'match',
              externalId: row.externalId,
              externalName: `${row.homeName} / ${row.awayName}`,
              entityId: id,
            });
          const previous = data.matches.find((m) => m.id === id);
          const merged = mergeOpenMatch(previous, {
            id,
            slug: previous?.slug ?? id,
            homeId,
            awayId,
            competitionId,
            season: scope.season,
            kickoff: row.kickoff,
            kickoffKnown: row.kickoffKnown,
            sourceDate: row.sourceDate,
            status: row.status,
            resultPeriod: 'regulation',
            homeScore: row.homeScore,
            awayScore: row.awayScore,
            round: row.round,
            events: [],
            lineups: [],
            statistics: [],
            updatedAt: new Date().toISOString(),
            source: 'openfootball',
            provenance: { schedule: 'openfootball' },
          });
          if (!previous) added++;
          else {
            const fields = [
              'kickoff',
              'kickoffKnown',
              'sourceDate',
              'status',
              'homeScore',
              'awayScore',
              'round',
            ] as const;
            if (fields.some((field) => previous[field] !== merged[field])) changed++;
            if (
              ['homeScore', 'awayScore', 'status'].some(
                (field) => previous[field as keyof Match] !== merged[field as keyof Match],
              )
            )
              resultsChanged++;
          }
          matches.push(merged);
        }
        if (newMatchIdentities.length)
          await db.footballIdentity.createMany({ data: newMatchIdentities, skipDuplicates: true });
        const upsert = <T extends { id: string }>(old: T[], fresh: T[]) => [
          ...new Map([...old, ...fresh].map((x) => [x.id, x])).values(),
        ];
        // Persist this season with its own competition year, then restore the latest display season.
        const seasonData: Dataset = {
          ...data,
          source: 'openfootball',
          updatedAt: new Date().toISOString(),
          competitions: upsert(data.competitions, [competition]),
          teams: upsert(data.teams, teams),
          matches: upsert(data.matches, matches),
          warning:
            'Source OpenFootball. Statistiques avancées indisponibles sans enrichissement. Les classements sont calculés à partir des résultats disponibles.',
        };
        seasonData.standings = {
          ...data.standings,
          [competitionId]: derivedStandings(matches, competitionId, 'general'),
        };
        await persistDataset(seasonData, new Set(matches.map((m) => m.id)), { profiles: false });
        data = seasonData;
        if (existingCompetition && existingCompetition.season > scope.season) {
          data.competitions = upsert(data.competitions, [existingCompetition]);
          data.standings[competitionId] = derivedStandings(
            data.matches.filter((m) => m.season === existingCompetition.season),
            competitionId,
            'general',
          );
        }
        await db.dataSource.upsert({
          where: { id: key },
          create: {
            id: key,
            url: response.url,
            license: 'CC0-1.0',
            etag: response.etag,
            contentHash: response.hash,
            lastSyncedAt: new Date(),
            payload: {
              competitionId,
              season: scope.season,
              matches: matches.length,
              teams: teams.length,
            },
          },
          update: {
            lastSyncedAt: new Date(),
            etag: response.etag,
            contentHash: response.hash,
            payload: {
              competitionId,
              season: scope.season,
              matches: matches.length,
              teams: teams.length,
            },
          },
        });
        imported += matches.length;
      } catch (error) {
        failures++;
        log('OPENFOOTBALL_IMPORT_FAILED', {
          code:
            error instanceof Error && /^[A-Z_0-9]+$/.test(error.message)
              ? error.message
              : 'INVALID_SOURCE_DATA',
        });
      }
    }
    if (imported || (requests > failures && data.matches.length)) {
      data.updatedAt = new Date().toISOString();
      data.degraded = failures > 0;
      data.warning = failures
        ? 'Certaines sources OpenFootball sont indisponibles. Derniers résultats sauvegardés conservés.'
        : 'Source OpenFootball. Statistiques avancées indisponibles sans enrichissement. Classements calculés sur les résultats disponibles.';
      data.matches.sort((a, b) => b.kickoff.localeCompare(a.kickoff));
      await persistDataset(data, new Set(), { profiles: false });
      if (imported) await rebuildElo(data.matches);
      await persistPredictions(data);
    }
    log('OPENFOOTBALL_IMPORT_FINISHED', { count: imported });
    return {
      status: failures ? 'partial' : 'success',
      matches: imported,
      requests,
      failures,
      added,
      changed,
      resultsChanged,
      unchangedSources,
      skippedSources,
    };
  });
}
