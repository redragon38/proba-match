import type { Dataset, Match } from '@/types/football';

/** A missing result cannot contribute zero goals to a historical summary. */
export function recordedGoals(matches: Pick<Match, 'homeScore' | 'awayScore'>[]) {
  const scored = matches.filter(
    (match) =>
      match.homeScore != null &&
      Number.isInteger(match.homeScore) &&
      match.homeScore >= 0 &&
      match.awayScore != null &&
      Number.isInteger(match.awayScore) &&
      match.awayScore >= 0,
  );
  const goals = scored.length
    ? scored.reduce((total, match) => total + match.homeScore! + match.awayScore!, 0)
    : null;
  return { matches: scored.length, goals, average: goals === null ? null : goals / scored.length };
}

/** The home leaderboard needs only each team's latest five results, not 129 full history scans. */
export function homeFormLeaders(data: Dataset, cutoff = new Date().toISOString()) {
  type Result = { kickoff: string; gf: number; ga: number };
  const byTeam = new Map<string, Result[]>();
  for (const match of data.matches) {
    if (
      match.status !== 'finished' ||
      match.homeScore === null ||
      match.awayScore === null ||
      match.kickoff >= cutoff
    ) continue;
    for (const [teamId, gf, ga] of [
      [match.homeId, match.homeScore, match.awayScore],
      [match.awayId, match.awayScore, match.homeScore],
    ] as const) {
      const rows = byTeam.get(teamId) ?? [];
      rows.push({ kickoff: match.kickoff, gf, ga });
      byTeam.set(teamId, rows);
    }
  }
  return data.teams
    .flatMap((team) => {
      const rows = byTeam.get(team.id);
      if (!rows || rows.length < 5) return [];
      const recent = rows.sort((a, b) => b.kickoff.localeCompare(a.kickoff)).slice(0, 5);
      return [{
        team,
        form: recent.map((row) => row.gf > row.ga ? 'V' : row.gf === row.ga ? 'N' : 'D'),
        points: recent.reduce((sum, row) => sum + (row.gf > row.ga ? 3 : row.gf === row.ga ? 1 : 0), 0),
        goals: recent.reduce((sum, row) => sum + row.gf, 0),
      }];
    })
    .sort((a, b) => b.points - a.points || b.goals - a.goals)
    .slice(0, 6);
}
export function teamMetricAverage(data: Dataset, teamId: string, label: string): number | null {
  const values = data.matches
    .filter((m) => m.status === 'finished' && (m.homeId === teamId || m.awayId === teamId))
    .map((m) => {
      const s = m.statistics.find((s) => s.label === label);
      return m.homeId === teamId ? s?.home : s?.away;
    })
    .filter((n): n is number => n !== null && n !== undefined);
  return values.length ? values.reduce((s, n) => s + n, 0) / values.length : null;
}
export function teamSummary(
  data: Dataset,
  teamId: string,
  cutoff = new Date().toISOString(),
  venue: 'all' | 'home' | 'away' = 'all',
) {
  const matches = data.matches
    .filter(
      (m) =>
        m.status === 'finished' &&
        m.homeScore !== null &&
        m.awayScore !== null &&
        m.kickoff < cutoff &&
        (venue === 'home'
          ? m.homeId === teamId
          : venue === 'away'
            ? m.awayId === teamId
            : m.homeId === teamId || m.awayId === teamId),
    )
    .sort((a, b) => b.kickoff.localeCompare(a.kickoff));
  const results = matches.map((m) => ({
    gf: m.homeId === teamId ? m.homeScore! : m.awayScore!,
    ga: m.homeId === teamId ? m.awayScore! : m.homeScore!,
  }));
  const scored = results.reduce((s, r) => s + r.gf, 0),
    conceded = results.reduce((s, r) => s + r.ga, 0);
  return {
    matches,
    played: matches.length,
    scored,
    conceded,
    cleanSheets: results.filter((r) => r.ga === 0).length,
    winRate: matches.length ? results.filter((r) => r.gf > r.ga).length / matches.length : null,
    goalsPerGame: matches.length ? scored / matches.length : null,
    concededPerGame: matches.length ? conceded / matches.length : null,
    form: results.slice(0, 5).map((r) => (r.gf > r.ga ? 'V' : r.gf === r.ga ? 'N' : 'D')),
    lastTen: results.slice(0, 10),
  };
}
