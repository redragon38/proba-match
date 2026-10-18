import type { Match } from '@/types/football';

/**
 * Public pages address immutable forecasts by match id. A fixture may remain
 * `scheduled` briefly after its theoretical kickoff while provider status is
 * delayed, so wall-clock filtering would make pages disagree about the same
 * archived forecast.
 */
export function publicPredictionIds(matches: readonly Match[]) {
  return new Set(matches.filter((match) => match.status === 'scheduled').map((match) => match.id));
}
