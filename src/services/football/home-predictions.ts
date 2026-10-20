import type { Dataset } from '@/types/football';
import { validResult } from '@/prediction-engine/availability';
import { upcomingSelection } from './match-selection';

/** The snapshot date describes publication, not today's calendar or prediction window. */
export function homePredictionCandidates(data: Dataset, now = Date.now()) {
  const counts = new Map<string, number>();
  for (const match of data.matches) {
    if (!validResult(match) || Date.parse(match.kickoff) >= now) continue;
    for (const id of [match.homeId, match.awayId]) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return upcomingSelection(data, now, 48)
    .filter((match) => [match.homeId, match.awayId].every((id) => (counts.get(id) ?? 0) >= 5))
    .slice(0, 6);
}
