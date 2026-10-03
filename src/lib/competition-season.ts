import type { Competition } from '@/types/football';
/** A Brazilian or MLS season is one calendar year, not a European split-year season. */
export function competitionSeason(
  competition: Pick<Competition, 'name'> | undefined,
  year: number,
) {
  return competition && ['Brasileirão', 'Major League Soccer'].includes(competition.name)
    ? String(year)
    : `${year}/${year + 1}`;
}
