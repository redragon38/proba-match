import 'server-only';

import { slugify } from '@/lib/format';
import { derivedStandings } from '@/services/derived-standings';
import type { Competition, Dataset, Match, Team } from '@/types/football';

import { openScopes } from './openfootball-sync';
import { OPEN_LEAGUES, OpenFootballProvider, type OpenLeague } from './providers/openfootball';
import { stableEntityId } from './stable-identity';

function competitionFor(league: OpenLeague, season: number): Competition {
  const config = OPEN_LEAGUES[league];
  const id = stableEntityId('openfootball', 'competition', league);
  return {
    id,
    slug: slugify(config.name),
    name: config.name,
    country: config.country,
    flag: league.slice(0, 2).toUpperCase(),
    season,
  };
}

function teamId(league: OpenLeague, teamKey: string) {
  return stableEntityId('openfootball', 'team', `${league}:${teamKey}`);
}

export async function createPublicOpenFootballFallback(now = new Date()): Promise<Dataset> {
  const provider = new OpenFootballProvider();
  const competitions: Competition[] = [];
  const teams = new Map<string, Team>();
  const matches: Match[] = [];
  let failures = 0;

  for (const scope of openScopes(false)) {
    try {
      const response = await provider.season(scope.league, scope.season);
      if (response.unchanged) continue;

      const competition = competitionFor(scope.league, scope.season);
      competitions.push(competition);

      for (const row of response.data.matches) {
        const homeId = teamId(scope.league, row.homeKey);
        const awayId = teamId(scope.league, row.awayKey);

        for (const [id, name] of [
          [homeId, row.homeKey, row.homeName],
          [awayId, row.awayKey, row.awayName],
        ].map(([id, , name]) => [id, name] as const)) {
          if (!teams.has(id))
            teams.set(id, {
              id,
              name,
              slug: `${slugify(name)}-${id.slice(0, 8)}`,
              short: name.slice(0, 3).toUpperCase(),
              color: '#365e6d',
              country: response.data.config.country,
              competitionId: competition.id,
            });
        }

        const id = stableEntityId('openfootball', 'match', row.externalId);
        matches.push({
          id,
          slug: id,
          homeId,
          awayId,
          competitionId: competition.id,
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
          updatedAt: now.toISOString(),
          source: 'openfootball',
          provenance: { schedule: 'openfootball' },
        });
      }
    } catch {
      failures++;
    }
  }

  const standings: Dataset['standings'] = {};
  for (const competition of competitions)
    standings[competition.id] = derivedStandings(
      matches.filter((m) => m.competitionId === competition.id),
      competition.id,
      'general',
    );

  return {
    source: 'openfootball',
    updatedAt: now.toISOString(),
    competitions,
    teams: [...teams.values()],
    matches: matches.sort((a, b) => b.kickoff.localeCompare(a.kickoff)),
    players: [],
    injuries: [],
    standings,
    degraded: true,
    warning:
      failures && failures === openScopes(false).length
        ? 'La base de données est indisponible et les sources publiques OpenFootball ne répondent pas. Les guides restent accessibles.'
        : 'Mode secours OpenFootball : calendrier et résultats publics affichés sans prédictions historiques, compositions, joueurs ni statistiques avancées.',
    verifiedAt: { calendar: now.toISOString(), results: now.toISOString() },
  };
}

export function hasPublicFallbackData(data: Dataset) {
  return data.competitions.length > 0 || data.teams.length > 0 || data.matches.length > 0;
}
