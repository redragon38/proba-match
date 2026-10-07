import { validResult } from '@/prediction-engine/availability';
import type { Competition, Dataset, Match } from '@/types/football';
import { derivedStandings } from '@/services/derived-standings';
import { searchSource } from '@/services/search-index';

/** Aggregate the selected season on the server, including matches outside the visible list. */
export function competitionView(
  data: Dataset,
  competition: Competition,
  query: { saison?: string; statut?: string } = {},
) {
  const allMatches = data.matches.filter((match) => match.competitionId === competition.id);
  const seasons = [
    ...new Set([
      competition.season,
      ...allMatches.map((match) => match.season ?? competition.season),
    ]),
  ].sort((a, b) => b - a);
  const requestedSeason = Number(query.saison);
  const season = seasons.includes(requestedSeason) ? requestedSeason : competition.season;
  const current = season === competition.season;
  const mode = ['scheduled', 'finished', 'live'].includes(query.statut ?? '')
    ? query.statut!
    : current
      ? 'scheduled'
      : 'finished';
  const matches = allMatches.filter((match) => (match.season ?? competition.season) === season);
  const table = current
    ? (data.standings[competition.id] ?? [])
    : derivedStandings(matches, competition.id, 'general');
  const teamIds = new Set(matches.flatMap((match) => [match.homeId, match.awayId]));
  for (const row of table) teamIds.add(row.teamId);
  const teams = data.teams.filter((team) => teamIds.has(team.id));
  const finished = matches.filter(validResult);
  const players = current
    ? data.players.filter(
        (player) =>
          teamIds.has(player.teamId) &&
          (data.source === 'demo' ||
            (player.statsScope?.verified === true &&
              player.statsScope.competitionId === competition.id &&
              player.statsScope.season === season &&
              player.statsScope.teamId === player.teamId)),
      )
    : [];
  const rank = (stat: 'goals' | 'assists', limit: number) =>
    players
      .filter(
        (player) => Number.isSafeInteger(player.stats[stat]) && (player.stats[stat] ?? -1) >= 0,
      )
      .sort((a, b) => b.stats[stat]! - a.stats[stat]! || a.id.localeCompare(b.id))
      .slice(0, limit)
      .map((player) => ({
        id: player.id,
        name: player.name,
        slug: player.slug,
        teamId: player.teamId,
        stats: { goals: player.stats.goals, assists: player.stats.assists },
      }));
  return {
    source: searchSource(data),
    competition: { ...competition, season },
    seasons,
    mode,
    seasonFallback: query.saison !== undefined && !seasons.includes(requestedSeason),
    seasonInferredCount: current ? matches.filter((m) => m.season == null).length : 0,
    teams,
    metrics: {
      matches: matches.length,
      finished: finished.length,
      goals: finished.length
        ? finished.reduce((total, match) => total + match.homeScore! + match.awayScore!, 0)
        : null,
    },
    table,
    passers: rank('assists', 5),
    scorers: rank('goals', 10),
    matches: matches
      .filter((match) => match.status === mode)
      .sort((a, b) =>
        mode === 'finished'
          ? b.kickoff.localeCompare(a.kickoff)
          : a.kickoff.localeCompare(b.kickoff),
      )
      .slice(0, 20)
      .map((match): Match => ({
        id: match.id,
        slug: match.slug,
        homeId: match.homeId,
        awayId: match.awayId,
        competitionId: match.competitionId,
        kickoff: match.kickoff,
        kickoffKnown: match.kickoffKnown,
        sourceDate: match.sourceDate,
        status: match.status,
        phase: match.phase,
        minute: match.minute,
        extra: match.extra,
        homeScore: match.status === 'finished' && !validResult(match) ? null : match.homeScore,
        awayScore: match.status === 'finished' && !validResult(match) ? null : match.awayScore,
        round: match.round,
        source: match.source,
        updatedAt: match.updatedAt,
        events: match.events.filter((event) => event.type === 'red'),
        lineups: [],
        statistics: [],
      })),
  };
}
export type CompetitionView = ReturnType<typeof competitionView>;
