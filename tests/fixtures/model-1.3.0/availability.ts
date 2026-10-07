import type { Match } from '@/types/football';

export type AvailabilityMode = 'observed' | 'reconstructed';

export function validResult(
  match: Pick<Match, 'status' | 'kickoff' | 'homeId' | 'awayId' | 'homeScore' | 'awayScore'>,
): boolean {
  return (
    match.status === 'finished' &&
    [match.homeScore, match.awayScore].every(
      (score) => typeof score === 'number' && Number.isSafeInteger(score) && score >= 0,
    ) &&
    match.homeId !== match.awayId &&
    Number.isFinite(Date.parse(match.kickoff))
  );
}

/** A date-only fixture is held until the following day, never midnight on its date. */
export function theoreticalResultTime(match: Match): number {
  const kickoff =
    match.kickoffKnown === false
      ? Date.parse(`${(match.sourceDate ?? match.kickoff).slice(0, 10)}T00:00:00Z`) + 86400_000
      : Date.parse(match.kickoff);
  return kickoff + 3 * 3600_000;
}

export function resultAvailable(match: Match, cutoff: string, mode: AvailabilityMode = 'observed') {
  if (!validResult(match)) return false;
  const at = match.resultObservedAt
    ? Date.parse(match.resultObservedAt)
    : mode === 'reconstructed' || match.source === 'demo'
      ? theoreticalResultTime(match)
      : NaN;
  // A prematurely reported final score must not become pre-match information.
  return Number.isFinite(at) && at > Date.parse(match.kickoff) && at < Date.parse(cutoff);
}

/** Timestamp the current score revision when this application ingests it. */
export function observeResult(
  match: Match,
  previous: Match | undefined,
  observedAt: string,
): Match {
  if (!validResult(match)) return { ...match, resultObservedAt: undefined };
  const same =
    previous &&
    validResult(previous) &&
    previous.homeScore === match.homeScore &&
    previous.awayScore === match.awayScore &&
    previous.homeId === match.homeId &&
    previous.awayId === match.awayId &&
    previous.kickoff === match.kickoff;
  return {
    ...match,
    resultObservedAt: same && previous.resultObservedAt ? previous.resultObservedAt : observedAt,
  };
}
