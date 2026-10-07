import type { Match } from '@/types/football';
const score = (n: unknown): n is number =>
  typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
/** Score used for regulation 1X2. Never infer 90 minutes from an AET/PEN final. */
export function regulationResult(match: Match, allowLegacy = false): Match | null {
  if (match.status !== 'finished') return null;
  const ft = match.scoreBreakdown?.fulltime;
  if (score(ft?.home) && score(ft?.away))
    return { ...match, homeScore: ft.home, awayScore: ft.away, resultPeriod: 'regulation' };
  if (
    (match.resultPeriod === 'regulation' ||
      ((allowLegacy || match.source === 'demo') && match.resultPeriod == null)) &&
    score(match.homeScore) &&
    score(match.awayScore)
  )
    return match;
  return null;
}
