import type { Dataset } from '@/types/football';

export const lateResultsWarning =
  'Certains matchs passés restent sans résultat dans la source OpenFootball. Les derniers scores et les classements peuvent être incomplets.';

export function hasLateOpenResults(
  data: Pick<Dataset, 'source' | 'matches'> | undefined,
  now = Date.now(),
) {
  return (
    data?.source === 'openfootball' &&
    data.matches.some(
      (match) =>
        match.source === 'openfootball' &&
        match.status === 'scheduled' &&
        now - Date.parse(match.kickoff) > (match.kickoffKnown === false ? 24 : 6) * 3600000,
    )
  );
}

/** Check after the memory cache: elapsed time can change without a new DB revision. */
export function withSourceFreshness(data: Dataset, now = Date.now()): Dataset {
  if (!hasLateOpenResults(data, now)) return data;
  return {
    ...data,
    degraded: true,
    warning: data.warning?.includes(lateResultsWarning)
      ? data.warning
      : [data.warning, lateResultsWarning].filter(Boolean).join(' '),
  };
}
