import { db } from '@/database/client';
import { slugify } from '@/lib/format';
import { log } from '@/lib/logger';
import type { Competition, Match, Player, Team } from '@/types/football';
import {
  EspnProvider,
  EXPANDED_LEAGUES,
  expandedScopes,
  expandedSeason,
  espnTeamCountry,
  type ExpandedLeague,
} from './providers/espn';
import { resolveIdentity, bindIdentity } from './identities';
import { footballJob } from './jobs';
import { readLocalDataset, readLocalHistory } from './local-store';
import { persistDataset, persistMatchDetails, persistPlayerProfiles } from './persistence';
import { derivedStandings } from '@/services/derived-standings';
import { rebuildElo } from './rebuild-elo';
import { persistPredictions } from '@/services/predictions';
import { stableEntityId } from './stable-identity';
import { addObservedPlayerProfiles } from './match-profiles';
const upsert = <T extends { id: string }>(old: T[], fresh: T[]) => [
  ...new Map([...old, ...fresh].map((x) => [x.id, x])).values(),
];

export async function syncExpandedFootball(
  options: {
    history?: boolean;
    force?: boolean;
    leagues?: ExpandedLeague[];
    predictions?: boolean;
    currentOnly?: boolean;
  } = {},
) {
  return footballJob('espn', async () => {
    const data = await readLocalDataset();
    data.matches = await readLocalHistory();
    const provider = new EspnProvider();
    let imported = 0,
      failures = 0,
      skippedSources = 0;
    for (const { league, season } of expandedScopes(!options.currentOnly)
      .filter(
        (scope) =>
          options.history ||
          scope.season === expandedSeason(scope.league) ||
          !data.competitions.some(
            (c) =>
              c.name === EXPANDED_LEAGUES[scope.league].name &&
              c.season === expandedSeason(scope.league),
          ),
      )
      .filter((s) => !options.leagues || options.leagues.includes(s.league))) {
      const key = `espn:${league}:${season}`,
        config = EXPANDED_LEAGUES[league];
      const prior = await db.dataSource.findUnique({ where: { id: key } });
      const ttl = season < expandedSeason(league) ? 30 * 86400_000 : 6 * 3600_000;
      if (
        !options.force &&
        prior?.lastSyncedAt &&
        Date.now() - prior.lastSyncedAt.getTime() < ttl
      ) {
        skippedSources++;
        continue;
      }
      try {
        const rows = await provider.season(league, season);
        if (!rows.length) throw new Error('ESPN_SEASON_UNAVAILABLE');
        const competitionId = await resolveIdentity(
          'espn',
          'competition',
          league,
          config.name,
          data.competitions
            .filter((c) => c.name === config.name && c.country === config.country)
            .map((c) => c.id),
        );
        await bindIdentity('api-football', 'competition', config.apiId, competitionId);
        const old = data.competitions.find((c) => c.id === competitionId);
        const competition: Competition = {
          id: competitionId,
          slug: old?.slug ?? slugify(config.name),
          name: config.name,
          country: config.country,
          flag: config.flag,
          season,
          logo: `/competition-logos/${config.logo}.webp`,
        };
        const teams: Team[] = [];
        const ids = new Map<string, string>();
        for (const t of new Map(
          rows.flatMap((m) => [m.home, m.away]).map((t) => [t.id, t]),
        ).values()) {
          const id = await resolveIdentity(
            'espn',
            'team',
            t.id,
            t.displayName,
            data.teams
              .filter(
                (x) =>
                  x.country === espnTeamCountry(league, t.id) &&
                  slugify(x.name) === slugify(t.displayName),
              )
              .map((t) => t.id),
          );
          ids.set(t.id, id);
          const before = data.teams.find((t) => t.id === id);
          teams.push({
            ...before,
            id,
            name: t.displayName,
            slug: before?.slug ?? `${slugify(t.displayName)}-${id.slice(0, 8)}`,
            short: t.abbreviation ?? t.displayName.slice(0, 3),
            color: /^[a-f0-9]{6}$/i.test(t.color ?? '') ? `#${t.color}` : '#365e6d',
            country: espnTeamCountry(league, t.id),
            competitionId,
            logo: t.logo ?? before?.logo,
          });
        }
        const matches: Match[] = [];
        const knownMatches = new Map(
          (
            await db.footballIdentity.findMany({
              where: {
                provider: 'espn',
                kind: 'match',
                externalId: { in: rows.map((r) => r.externalId) },
              },
              select: { externalId: true, entityId: true },
            })
          ).map((i) => [i.externalId, i.entityId]),
        );
        const newIdentities: {
          provider: string;
          kind: string;
          externalId: string;
          entityId: string;
          externalName: string;
        }[] = [];
        for (const row of rows) {
          const id =
            knownMatches.get(row.externalId) ?? stableEntityId('espn', 'match', row.externalId);
          if (!knownMatches.has(row.externalId))
            newIdentities.push({
              provider: 'espn',
              kind: 'match',
              externalId: row.externalId,
              entityId: id,
              externalName: `${row.home.displayName} / ${row.away.displayName}`,
            });
          const previous = data.matches.find((m) => m.id === id);
          const secondary = previous?.source === 'api-football';
          matches.push({
            ...previous,
            id,
            slug: previous?.slug ?? id,
            competitionId,
            season,
            homeId: ids.get(row.home.id)!,
            awayId: ids.get(row.away.id)!,
            kickoff: row.kickoff,
            kickoffKnown: row.kickoffKnown,
            status: row.status,
            resultPeriod: row.resultPeriod,
            homeScore: row.homeScore,
            awayScore: row.awayScore,
            round: row.round,
            countsForStandings: row.countsForStandings,
            venue: row.venue,
            events: previous?.events ?? [],
            lineups: previous?.lineups ?? [],
            statistics: row.statistics.length ? row.statistics : (previous?.statistics ?? []),
            updatedAt: new Date().toISOString(),
            source: 'espn',
            provenance: {
              schedule: 'espn',
              details: row.statistics.length ? 'espn' : previous?.provenance?.details,
            },
            ...(secondary
              ? {
                  status: previous.status,
                  homeScore: previous.homeScore,
                  awayScore: previous.awayScore,
                  kickoff: previous.kickoff,
                  source: previous.source,
                  statistics: previous.statistics,
                  provenance: { schedule: 'espn', details: previous.provenance?.details },
                }
              : {}),
          });
        }
        if (newIdentities.length)
          await db.footballIdentity.createMany({ data: newIdentities, skipDuplicates: true });
        data.competitions = upsert(data.competitions, [competition]);
        data.teams = upsert(data.teams, teams);
        data.matches = upsert(data.matches, matches);
        data.updatedAt = new Date().toISOString();
        data.standings[competitionId] = derivedStandings(matches, competitionId, 'general');
        await persistDataset(data, new Set(matches.map((m) => m.id)), { profiles: false });
        // Historical seasons remain relational; the display defaults to the most recent imported season.
        if (old && old.season > season) {
          data.competitions = upsert(data.competitions, [old]);
          data.standings[competitionId] = derivedStandings(
            data.matches.filter((m) => m.season === old.season),
            competitionId,
            'general',
          );
        }
        const value = {
          url: `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/scoreboard`,
          license: 'ESPN public API; ESPN terms apply (not CC0)',
          lastSyncedAt: new Date(),
          payload: {
            competitionId,
            season,
            matches: matches.length,
            teams: teams.length,
            statistics: matches.filter((m) => m.statistics.length).length,
          },
        };
        await db.dataSource.upsert({
          where: { id: key },
          create: { id: key, ...value },
          update: value,
        });
        imported += matches.length;
        log('ESPN_SEASON_IMPORTED', { code: `${league}:${season}`, count: matches.length });
      } catch (error) {
        failures++;
        log('ESPN_IMPORT_FAILED', {
          code:
            error instanceof Error && /^[A-Z_0-9]+$/.test(error.message)
              ? error.message
              : 'INVALID_SOURCE_DATA',
        });
      }
    }
    if (imported) {
      data.matches.sort((a, b) => b.kickoff.localeCompare(a.kickoff));
      await persistDataset(data, new Set(), { profiles: false });
      await rebuildElo(data.matches);
      if (options.predictions !== false) await persistPredictions(data);
    }
    return {
      status: failures ? 'partial' : 'success',
      matches: imported,
      requests: provider.requests,
      failures,
      skippedSources,
    };
  });
}

export async function syncExpandedPlayers(limit = 30) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 30) throw new Error('INVALID_BATCH_LIMIT');
  return footballJob('espn-players', async () => {
    const data = await readLocalDataset();
    const provider = new EspnProvider();
    let imported = 0,
      failures = 0;
    const profileIds = new Set<string>();
    const completed: {
      key: string;
      value: {
        url: string;
        license: string;
        lastSyncedAt: Date;
        payload: { teamId: string; season: number; players: number };
      };
    }[] = [];
    const eligible: { team: Team; externalId: string; league: ExpandedLeague; season: number }[] =
      [];
    const rosterSources = await db.dataSource.findMany({
      where: { id: { startsWith: 'espn:roster:' } },
      select: { id: true, lastSyncedAt: true },
    });
    const rosterDates = new Map(
      rosterSources.map((row) => [row.id, row.lastSyncedAt?.getTime() ?? 0]),
    );
    for (const league of Object.keys(EXPANDED_LEAGUES) as ExpandedLeague[]) {
      const competition = await db.footballIdentity.findUnique({
        where: {
          provider_kind_externalId: { provider: 'espn', kind: 'competition', externalId: league },
        },
      });
      if (!competition) continue;
      const c = data.competitions.find((c) => c.id === competition.entityId);
      if (!c) continue;
      const active = new Set(
        data.matches
          .filter((m) => m.competitionId === c.id && m.season === c.season)
          .flatMap((m) => [m.homeId, m.awayId]),
      );
      const identities = await db.footballIdentity.findMany({
        where: { provider: 'espn', kind: 'team', entityId: { in: [...active] } },
      });
      for (const identity of identities) {
        const t = data.teams.find((t) => t.id === identity.entityId);
        if (!t) continue;
        const lastSynced = rosterDates.get(`espn:roster:${t.id}:${c.season}`) ?? 0;
        if (!lastSynced || Date.now() - lastSynced > 86400_000)
          eligible.push({ team: t, externalId: identity.externalId, league, season: c.season });
      }
    }
    // Fair coverage of all five leagues before filling the remaining teams.
    const groups = new Map<ExpandedLeague, typeof eligible>();
    for (const row of eligible) groups.set(row.league, [...(groups.get(row.league) ?? []), row]);
    // A daily cron must fill missing squads before refreshing yesterday's first batch.
    for (const rows of groups.values())
      rows.sort(
        (a, b) =>
          (rosterDates.get(`espn:roster:${a.team.id}:${a.season}`) ?? 0) -
          (rosterDates.get(`espn:roster:${b.team.id}:${b.season}`) ?? 0),
      );
    const selected: typeof eligible = [];
    while (selected.length < limit && [...groups.values()].some((g) => g.length))
      for (const g of groups.values()) {
        const row = g.shift();
        if (row && selected.length < limit) selected.push(row);
      }
    for (const { team, externalId, league, season } of selected) {
      try {
        const rows = await provider.roster(league, externalId, season);
        if (!rows.length) throw new Error('ESPN_EMPTY_ROSTER');
        const next: Player[] = [];
        for (const row of rows) {
          const id = await resolveIdentity('espn', 'player', row.externalId, row.name, []);
          const old = data.players.find((p) => p.id === id);
          next.push({
            ...old,
            id,
            slug: old?.slug ?? `${slugify(row.name)}-${id.slice(0, 8)}`,
            name: row.name,
            teamId: team.id,
            position: row.position,
            number: row.number,
            nationality: row.nationality,
            photo: row.photo ?? old?.photo,
            birthDate: row.birthDate,
            height: row.height,
            stats: row.stats,
            statsScope: {
              competitionId: team.competitionId,
              teamId: team.id,
              season,
              source: 'espn',
              observedAt: new Date().toISOString(),
              type: 'season',
              verified: true,
            },
            source: 'espn',
            updatedAt: new Date().toISOString(),
          });
        }
        // Keep verified profiles from other sources; don't keep withdrawn ESPN players in the active roster.
        const removed = data.players.filter(
          (p) => p.teamId === team.id && p.source === 'espn' && !next.some((n) => n.id === p.id),
        );
        data.players = upsert(
          data.players.filter((p) => !removed.some((r) => r.id === p.id)),
          next,
        );
        if (removed.length)
          await db.searchIndex.deleteMany({
            where: { id: { in: removed.map((p) => `player:${p.id}`) } },
          });
        imported += next.length;
        const key = `espn:roster:${team.id}:${season}`;
        const value = {
          url: `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/teams/${externalId}/roster?season=${season}`,
          license: 'ESPN public API; ESPN terms apply',
          lastSyncedAt: new Date(),
          payload: { teamId: team.id, season, players: next.length },
        };
        // Persist before marking the roster fresh so a failed write remains retryable.
        next.forEach((p) => profileIds.add(p.id));
        completed.push({ key, value });
      } catch (error) {
        failures++;
        log('ESPN_ROSTER_FAILED', {
          code:
            error instanceof Error && /^[A-Z_0-9]+$/.test(error.message)
              ? error.message
              : 'INVALID_SOURCE_DATA',
        });
      }
    }
    if (imported) {
      data.updatedAt = new Date().toISOString();
      await persistPlayerProfiles(data, profileIds);
      for (const { key, value } of completed)
        await db.dataSource.upsert({
          where: { id: key },
          create: { id: key, ...value },
          update: value,
        });
    }
    return {
      status: failures ? 'partial' : 'success',
      players: imported,
      teams: selected.length,
      remaining: Math.max(0, eligible.length - selected.length),
      requests: provider.requests,
      failures,
    };
  });
}

export async function syncExpandedMatchDetails(limit = 3) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 5) throw new Error('INVALID_BATCH_LIMIT');
  return footballJob('espn-details', async () => {
    const data = await readLocalDataset();
    const provider = new EspnProvider();
    const matchIdentities = await db.footballIdentity.findMany({
      where: { provider: 'espn', kind: 'match' },
      select: { externalId: true, entityId: true },
    });
    const externalByMatch = new Map(
      matchIdentities.map((identity) => [identity.entityId, identity.externalId]),
    );
    const competitionIdentities = await db.footballIdentity.findMany({
      where: { provider: 'espn', kind: 'competition' },
      select: { externalId: true, entityId: true },
    });
    const leagueByCompetition = new Map(
      competitionIdentities.map((identity) => [identity.entityId, identity.externalId]),
    );
    const selected = data.matches
      .filter(
        (match) =>
          match.status === 'finished' &&
          !match.lineups.length &&
          externalByMatch.has(match.id) &&
          leagueByCompetition.has(match.competitionId),
      )
      .sort((a, b) => b.kickoff.localeCompare(a.kickoff))
      .slice(0, limit);
    const changed = new Set<string>();
    const profileIds = new Set<string>();
    let failures = 0;
    for (const match of selected) {
      try {
        const league = leagueByCompetition.get(match.competitionId) as ExpandedLeague;
        if (!(league in EXPANDED_LEAGUES)) throw new Error('ESPN_UNKNOWN_LEAGUE');
        const externalMatchId = externalByMatch.get(match.id)!;
        const summary = await provider.summary(league, externalMatchId);
        const teamIdentities = await db.footballIdentity.findMany({
          where: {
            provider: 'espn',
            kind: 'team',
            entityId: { in: [match.homeId, match.awayId] },
          },
          select: { externalId: true, entityId: true },
        });
        const teamByExternal = new Map(
          teamIdentities.map((identity) => [identity.externalId, identity.entityId]),
        );
        const playerByExternal = new Map<string, string>();
        for (const row of summary.performances)
          if (!playerByExternal.has(row.playerId))
            playerByExternal.set(
              row.playerId,
              await resolveIdentity('espn', 'player', row.playerId, row.name, []),
            );
        const lineups = summary.lineups.flatMap((lineup) => {
          const teamId = teamByExternal.get(lineup.externalTeamId);
          if (!teamId) return [];
          return [
            {
              ...lineup,
              teamId,
              starters: lineup.starters.map((player) => ({
                ...player,
                id: playerByExternal.get(player.id)!,
              })),
              substitutes: lineup.substitutes.map((player) => ({
                ...player,
                id: playerByExternal.get(player.id)!,
              })),
            },
          ];
        });
        const performances = summary.performances.flatMap((performance) => {
          const teamId = teamByExternal.get(performance.externalTeamId);
          const playerId = playerByExternal.get(performance.playerId);
          return teamId && playerId ? [{ ...performance, teamId, playerId }] : [];
        });
        if (lineups.length !== 2 || performances.length < 22)
          throw new Error('ESPN_INCOMPLETE_MATCH_DETAILS');
        const observedAt = new Date().toISOString();
        const merged: Match = {
          ...match,
          statistics: summary.statistics.length ? summary.statistics : match.statistics,
          lineups,
          performances,
          detailsUpdatedAt: observedAt,
          provenance: { schedule: match.provenance?.schedule ?? match.source, details: 'espn' },
          detailSource: {
            ...match.detailSource,
            statistics: 'espn',
            lineups: 'espn',
            performances: 'espn',
          },
          detailPresence: {
            ...match.detailPresence,
            statistics: summary.statistics.length > 0,
            lineups: true,
            performances: true,
          },
          detailObservedAt: {
            ...match.detailObservedAt,
            statistics: observedAt,
            lineups: observedAt,
            performances: observedAt,
          },
        };
        data.matches[data.matches.indexOf(match)] = merged;
        addObservedPlayerProfiles(data, merged);
        performances.forEach((performance) => profileIds.add(performance.playerId));
        changed.add(match.id);
      } catch (error) {
        failures++;
        log('ESPN_DETAILS_FAILED', {
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
      failures,
    };
  });
}
