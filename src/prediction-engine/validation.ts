import type { EvaluatedPrediction, Match } from '@/types/football';
import { resultAvailable, type AvailabilityMode } from './availability';
import { metrics } from './evaluation';

export interface ValidationCandidate {
  id: string;
  rows: EvaluatedPrediction[];
}

/** Choose on available past results only; score future folds without using their outcomes to choose. */
export function temporalModelSelection(
  matches: Match[],
  candidates: ValidationCandidate[],
  boundaries: string[],
  mode: AvailabilityMode = 'observed',
  minimumTraining = 200,
) {
  if (
    !candidates.length ||
    new Set(candidates.map((c) => c.id)).size !== candidates.length ||
    !Number.isSafeInteger(minimumTraining) ||
    minimumTraining < 1
  )
    throw new Error('INVALID_VALIDATION_CANDIDATES');
  const times = boundaries.map(Date.parse);
  if (times.length < 2 || times.some((t, i) => !Number.isFinite(t) || (i > 0 && t <= times[i - 1])))
    throw new Error('INVALID_VALIDATION_BOUNDARIES');
  const fixtures = new Map(matches.map((m) => [m.id, m]));
  if (fixtures.size !== matches.length) throw new Error('DUPLICATE_MATCH_ID');
  const indexed = candidates.map((candidate) => {
    const rows = new Map(candidate.rows.map((r) => [r.prediction.matchId, r]));
    if (rows.size !== candidate.rows.length) throw new Error('DUPLICATE_PREDICTION_ROW');
    for (const row of rows.values()) {
      const match = fixtures.get(row.prediction.matchId);
      if (
        !match ||
        Date.parse(row.prediction.createdAt) >= Date.parse(match.kickoff) ||
        !Number.isFinite(Date.parse(row.prediction.createdAt)) ||
        !Number.isFinite(Date.parse(row.prediction.cutoff)) ||
        Date.parse(row.prediction.cutoff) > Date.parse(row.prediction.createdAt) ||
        row.homeScore !== match.homeScore ||
        row.awayScore !== match.awayScore ||
        Date.parse(row.kickoff) !== Date.parse(match.kickoff)
      )
        throw new Error('INVALID_VALIDATION_ROW');
    }
    return { id: candidate.id, rows };
  });
  // Common support avoids comparing candidates on different, easier fixture sets.
  const common = [...indexed[0].rows.keys()].filter((id) => indexed.every((c) => c.rows.has(id)));
  const selectedRows: EvaluatedPrediction[] = [];
  const referenceRows: EvaluatedPrediction[] = [];
  const folds = times.slice(0, -1).map((start, index) => {
    const end = times[index + 1];
    const cutoff = new Date(start).toISOString();
    const training = common.filter((id) => resultAvailable(fixtures.get(id)!, cutoff, mode));
    const testing = common.filter((id) => {
      const match = fixtures.get(id)!;
      const kickoff = Date.parse(match.kickoff);
      return kickoff >= start && kickoff < end;
    });
    if (training.length < minimumTraining || !testing.length)
      return {
        start: cutoff,
        end: new Date(end).toISOString(),
        trainingSample: training.length,
        testSample: testing.length,
        status: 'INSUFFICIENT_DATA' as const,
        selected: null,
      };
    const ranked = indexed
      .map((candidate, order) => ({
        candidate,
        order,
        trainingMetrics: metrics(training.map((id) => candidate.rows.get(id)!))!,
      }))
      .sort((a, b) => a.trainingMetrics.logLoss - b.trainingMetrics.logLoss || a.order - b.order);
    const selected = ranked[0].candidate;
    const testRows = testing.map((id) => selected.rows.get(id)!);
    const baseline = testing.map((id) => indexed[0].rows.get(id)!);
    selectedRows.push(...testRows);
    referenceRows.push(...baseline);
    return {
      start: cutoff,
      end: new Date(end).toISOString(),
      trainingSample: training.length,
      testSample: testing.length,
      status: 'EVALUATED' as const,
      selected: selected.id,
      training: ranked.map((r) => ({ candidate: r.candidate.id, metrics: r.trainingMetrics })),
      testMetrics: metrics(testRows),
      referenceMetrics: metrics(baseline),
    };
  });
  return {
    availabilityMode: mode,
    objective: 'logLoss' as const,
    reference: candidates[0].id,
    commonSample: common.length,
    folds,
    selectedMetrics: metrics(selectedRows),
    referenceMetrics: metrics(referenceRows),
  };
}
