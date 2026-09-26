import type { Dataset } from '@/types/football';
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
