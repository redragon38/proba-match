import { describe, expect, it } from 'vitest';
import { temporalModelSelection } from '@/prediction-engine/validation';
import { walkForwardBacktest } from '@/prediction-engine/backtest';
import { PredictionEngine } from '@/prediction-engine';
import { createDemoDataset } from '@/services/football/providers/mock';
import type { EvaluatedPrediction, Match } from '@/types/football';

const now = new Date('2026-09-11T12:00:00Z');
const demo = createDemoDataset(now);
const target = demo.matches.find((m) => m.id === 'demo-0-2')!;
const prediction = new PredictionEngine().predict(target, demo.matches, now.toISOString())!;
const makeMatch = (id: string, kickoff: string): Match => ({
  ...target,
  source: 'openfootball',
  resultPeriod: 'regulation',
  id,
  kickoff,
  status: 'finished',
  homeScore: 1,
  awayScore: 0,
  resultObservedAt: new Date(Date.parse(kickoff) + 3 * 3600_000).toISOString(),
});
const matches = [
  makeMatch('train-1', '2024-06-25T12:00:00Z'),
  makeMatch('train-2', '2024-06-26T12:00:00Z'),
  { ...makeMatch('delayed', '2024-06-30T12:00:00Z'), resultObservedAt: '2024-08-01T12:00:00Z' },
  makeMatch('test-1', '2024-07-02T12:00:00Z'),
  makeMatch('test-2', '2024-07-03T12:00:00Z'),
];
const rows = (home: number): EvaluatedPrediction[] =>
  matches.map((match) => ({
    prediction: {
      ...prediction,
      matchId: match.id,
      home,
      draw: (1 - home) / 2,
      away: (1 - home) / 2,
      createdAt: new Date(Date.parse(match.kickoff) - 1000).toISOString(),
      cutoff: new Date(Date.parse(match.kickoff) - 1000).toISOString(),
    },
    homeScore: match.homeScore!,
    awayScore: match.awayScore!,
    kickoff: match.kickoff,
    competitionId: match.competitionId,
  }));
const boundaries = ['2024-07-01T00:00:00Z', '2024-08-01T00:00:00Z'];

describe('Nested temporal parameter selection', () => {
  it('chooses using only results available before the fold, on common support', () => {
    const result = temporalModelSelection(
      matches,
      [
        { id: 'reference', rows: rows(0.4) },
        { id: 'candidate', rows: rows(0.8) },
      ],
      boundaries,
      'observed',
      2,
    );
    expect(result.folds[0]).toMatchObject({
      trainingSample: 2,
      testSample: 2,
      selected: 'candidate',
    });
    expect(result.selectedMetrics!.logLoss).toBeCloseTo(-Math.log(0.8));
    expect(result.referenceMetrics!.sample).toBe(result.selectedMetrics!.sample);
  });
  it('cannot choose a candidate from its future success', () => {
    const futurePerfect = rows(0.2).map((row) =>
      row.prediction.matchId.startsWith('test')
        ? { ...row, prediction: { ...row.prediction, home: 1, draw: 0, away: 0 } }
        : row,
    );
    const result = temporalModelSelection(
      matches,
      [
        { id: 'reference', rows: rows(0.6) },
        { id: 'future-perfect', rows: futurePerfect },
      ],
      boundaries,
      'observed',
      2,
    );
    expect(result.folds[0].selected).toBe('reference');
  });
  it('returns no metrics with insufficient or unjournaled history', () => {
    const result = temporalModelSelection(
      matches.map((m) => ({ ...m, resultObservedAt: undefined })),
      [{ id: 'reference', rows: rows(0.6) }],
      boundaries,
      'observed',
      2,
    );
    expect(result.folds[0].status).toBe('INSUFFICIENT_DATA');
    expect(result.selectedMetrics).toBeNull();
    expect(result.referenceMetrics).toBeNull();
  });
  it('does not credit forecasts missing from another candidate', () => {
    const result = temporalModelSelection(
      matches,
      [
        { id: 'reference', rows: rows(0.6) },
        { id: 'candidate', rows: rows(0.8).filter((r) => r.prediction.matchId !== 'test-2') },
      ],
      boundaries,
      'observed',
      2,
    );
    expect(result.commonSample).toBe(4);
    expect(result.referenceMetrics!.sample).toBe(1);
    expect(result.selectedMetrics!.sample).toBe(1);
  });
  it('uses the reference as a deterministic tie breaker', () => {
    expect(
      temporalModelSelection(
        matches,
        [
          { id: 'reference', rows: rows(0.6) },
          { id: 'same', rows: rows(0.6) },
        ],
        boundaries,
        'observed',
        2,
      ).folds[0].selected,
    ).toBe('reference');
  });
  it('rejects duplicate, post-kickoff and mismatched evaluation rows', () => {
    expect(() =>
      temporalModelSelection(
        matches,
        [{ id: 'duplicate', rows: [...rows(0.6), rows(0.6)[0]] }],
        boundaries,
      ),
    ).toThrow('DUPLICATE');
    const invalid = rows(0.6);
    invalid[0].prediction.createdAt = matches[0].kickoff;
    expect(() =>
      temporalModelSelection(matches, [{ id: 'late', rows: invalid }], boundaries),
    ).toThrow('INVALID_VALIDATION_ROW');
    const changed = rows(0.6);
    changed[0].homeScore = 3;
    expect(() =>
      temporalModelSelection(matches, [{ id: 'mismatch', rows: changed }], boundaries),
    ).toThrow('INVALID_VALIDATION_ROW');
    expect(() =>
      temporalModelSelection(
        matches,
        [{ id: 'reference', rows: rows(0.6) }],
        [...boundaries].reverse(),
      ),
    ).toThrow('BOUNDARIES');
  });
  it('rejects invalid backtest parameters before replay', () => {
    for (const parameters of [
      { goalStrength: 0 },
      { goalStrength: 2 },
      { halfLifeDays: 0 },
      { homeAdvantage: NaN },
    ])
      expect(() => walkForwardBacktest([], 'observed', parameters)).toThrow(
        'INVALID_BACKTEST_PARAMETERS',
      );
  });
});
