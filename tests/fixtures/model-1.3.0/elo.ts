import type { Match } from '@/types/football';
import { resultAvailable, type AvailabilityMode } from './availability';
export const initialElo = 1500;
export function updateElo(
  home: number,
  away: number,
  homeGoals: number,
  awayGoals: number,
  advantage = 60,
  k = 24,
) {
  if (
    ![home, away, homeGoals, awayGoals, advantage, k].every(Number.isFinite) ||
    homeGoals < 0 ||
    awayGoals < 0
  )
    throw new Error('INVALID_ELO_INPUT');
  const expected = 1 / (1 + 10 ** ((away - home - advantage) / 400));
  const result = homeGoals > awayGoals ? 1 : homeGoals === awayGoals ? 0.5 : 0;
  const margin = Math.log(Math.abs(homeGoals - awayGoals) + 1) + 1;
  const change = k * margin * (result - expected);
  return { home: home + change, away: away - change };
}
export function eloHistory(
  matches: Match[],
  cutoff: string,
  advantage = 60,
  mode: AvailabilityMode = 'observed',
) {
  const ratings = new Map<string, number>();
  const history: { teamId: string; matchId: string; before: number; after: number; at: string }[] =
    [];
  const completed = matches
    .filter((m) => resultAvailable(m, cutoff, mode))
    .sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff) || a.id.localeCompare(b.id));
  for (const m of completed) {
    const home = ratings.get(m.homeId) ?? initialElo,
      away = ratings.get(m.awayId) ?? initialElo;
    const updated = updateElo(home, away, m.homeScore!, m.awayScore!, advantage);
    for (const [teamId, before, after] of [
      [m.homeId, home, updated.home],
      [m.awayId, away, updated.away],
    ] as const) {
      ratings.set(teamId, after);
      history.push({
        teamId,
        matchId: m.id,
        before,
        after,
        at:
          m.resultObservedAt ??
          new Date(new Date(m.kickoff).getTime() + 3 * 3600_000).toISOString(),
      });
    }
  }
  return { ratings, history };
}
