import type { MatchStat } from '@/types/football';
/** ESPN sometimes supplies an entirely zero-filled unavailable statistics block.
 * Both sides cannot possess the ball 0% of a completed football game. */
export function reportedStatistics(statistics: MatchStat[]): MatchStat[] {
  const possession = statistics.find((s) => /possession/i.test(s.label));
  if (
    possession?.home === 0 &&
    possession.away === 0 &&
    statistics.every((s) => (s.home === 0 || s.home == null) && (s.away === 0 || s.away == null))
  )
    return [];
  return statistics.map((s) => {
    if (
      /possession/i.test(s.label) &&
      s.home != null &&
      s.away != null &&
      (s.home < 0 ||
        s.away < 0 ||
        s.home > 100 ||
        s.away > 100 ||
        Math.abs(s.home + s.away - 100) > 2)
    )
      return { ...s, home: null, away: null };
    return s;
  });
}
