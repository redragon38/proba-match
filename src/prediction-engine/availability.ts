import type { Match, ResultRevision } from '@/types/football';
import { regulationResult } from './result-period';

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
  const selected = resultAt(match, cutoff, mode);
  if (!selected) return false;
  match = selected;
  if (!regulationResult(match, mode === 'reconstructed')) return false;
  if (!validResult(match)) return false;
  const at = match.resultObservedAt
    ? Date.parse(match.resultObservedAt)
    : mode === 'reconstructed' || match.source === 'demo'
      ? theoreticalResultTime(match)
      : NaN;
  // A prematurely reported final score must not become pre-match information.
  return Number.isFinite(at) && at > Date.parse(match.kickoff) && at < Date.parse(cutoff);
}

/** Most recent received revision, including withdrawals. Never fall back past a withdrawal. */
export function resultAt(
  match: Match,
  cutoff: string,
  mode: AvailabilityMode = 'observed',
): Match | null {
  const revisions = match.resultRevisions;
  if (!revisions?.length) {
    const at = match.resultObservedAt
      ? Date.parse(match.resultObservedAt)
      : mode === 'reconstructed' || match.source === 'demo'
        ? theoreticalResultTime(match)
        : NaN;
    return Number.isFinite(at) && at < Date.parse(cutoff) ? match : null;
  }
  const revision = [...revisions]
    .filter(
      (r) =>
        Number.isFinite(Date.parse(r.observedAt)) && Date.parse(r.observedAt) < Date.parse(cutoff),
    )
    .sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt))
    .at(-1);
  return revision ? { ...match, ...revision, resultObservedAt: revision.observedAt } : null;
}
function revisionOf(match: Match, observedAt: string): ResultRevision {
  return {
    observedAt,
    source: match.source,
    homeId: match.homeId,
    awayId: match.awayId,
    kickoff: match.kickoff,
    status: match.status,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    resultPeriod: match.resultPeriod,
    scoreBreakdown: match.scoreBreakdown,
    neutralVenue: match.neutralVenue,
  };
}

/** Timestamp the current score revision when this application ingests it. */
export function observeResult(
  match: Match,
  previous: Match | undefined,
  observedAt: string,
): Match {
  const revisions = [...(previous?.resultRevisions ?? [])];
  // A real older reception timestamp can be retained; never synthesize one from kickoff.
  if (!revisions.length && previous?.resultObservedAt)
    revisions.push(revisionOf(previous, previous.resultObservedAt));
  const latest = revisions.at(-1);
  const next = revisionOf(match, observedAt);
  const comparable = (r: ResultRevision) => JSON.stringify({ ...r, observedAt: undefined });
  if ((!latest && validResult(match)) || (latest && comparable(latest) !== comparable(next)))
    revisions.push(next);
  if (!validResult(match))
    return { ...match, resultObservedAt: undefined, resultRevisions: revisions };
  const same =
    previous &&
    validResult(previous) &&
    previous.homeScore === match.homeScore &&
    previous.awayScore === match.awayScore &&
    previous.homeId === match.homeId &&
    previous.awayId === match.awayId &&
    previous.kickoff === match.kickoff &&
    previous.resultPeriod === match.resultPeriod &&
    JSON.stringify(previous.scoreBreakdown) === JSON.stringify(match.scoreBreakdown);
  return {
    ...match,
    resultObservedAt: same && previous.resultObservedAt ? previous.resultObservedAt : observedAt,
    resultRevisions: revisions,
  };
}
