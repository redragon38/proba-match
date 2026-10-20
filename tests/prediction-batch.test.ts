import { describe, expect, it } from 'vitest';
import { PredictionEngine } from '@/prediction-engine';
import { observeResult } from '@/prediction-engine/availability';
import { eloHistory } from '@/prediction-engine/elo';
import { createDemoDataset } from '@/services/football/providers/mock';
import type { Match, ResultRevision } from '@/types/football';

const now = '2026-10-20T12:00:00Z';
const data = createDemoDataset(new Date(now));

function reorder<T>(value: T): T {
  if (Array.isArray(value)) return value.map(reorder) as T;
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .reverse()
        .map(([k, v]) => [k, reorder(v)]),
    ) as T;
  return value;
}

describe('JSONB observations and batch forecasts', () => {
  it('does not append observations or reset their availability when JSONB reorders nested keys', () => {
    const result: Match = {
      ...data.matches.find((m) => m.status === 'finished')!,
      source: 'openfootball',
      resultPeriod: 'regulation',
      scoreBreakdown: { fulltime: { home: 2, away: 1 } },
      homeScore: 2,
      awayScore: 1,
      resultRevisions: [],
      resultObservedAt: undefined,
    };
    const initial = observeResult(result, undefined, '2026-10-19T12:00:00Z');
    const stored = reorder(JSON.parse(JSON.stringify(initial)));
    const repeated = observeResult(result, stored, now);
    expect(repeated.resultRevisions).toHaveLength(1);
    expect(repeated.resultObservedAt).toBe(initial.resultObservedAt);
    const corrected = observeResult(
      { ...result, homeScore: 3, scoreBreakdown: { fulltime: { home: 3, away: 1 } } },
      stored,
      now,
    );
    expect(corrected.resultRevisions).toHaveLength(2);
    expect(corrected.resultObservedAt).toBe(now);
  });

  it.each([true, false])(
    'keeps prepared forecasts and their archives identical to individual computation (archive %s)',
    (archive) => {
      const engine = new PredictionEngine();
      const batch = engine.prepare(data.matches, now, archive);
      for (const target of data.matches.filter((m) => m.status === 'scheduled').slice(0, 6)) {
        expect(batch(target)).toEqual(engine.predict(target, data.matches, now, archive));
      }
      expect(batch({ ...data.matches[0], kickoff: '2026-10-01T00:00:00Z' })).toBeNull();
    },
  );

  it('keeps reconstructed mode isolated from strict availability and excludes a replay target from its inputs', () => {
    const engine = new PredictionEngine();
    const real = data.matches.map((m) => ({
      ...m,
      source: 'openfootball' as const,
      resultObservedAt: undefined,
      resultRevisions: [],
    }));
    const target = real.find((m) => m.status === 'scheduled')!;
    expect(engine.prepare(real, now)(target)).toBeNull();
    expect(engine.prepareReconstructed(real, now)(target)).toEqual(
      engine.predictReconstructed(target, real, now),
    );
    const replay = { ...target, id: real.find((m) => m.status === 'finished')!.id };
    expect(engine.prepareReconstructed(real, now)(replay)).toEqual(
      engine.predictReconstructed(replay, real, now),
    );
  });

  it('ignores redundant Elo folds but preserves corrections, withdrawals, reinstatement and historical ratings', () => {
    const template = data.matches[0];
    const rev = (
      observedAt: string,
      homeScore: number | null,
      status: Match['status'] = 'finished',
    ): ResultRevision => ({
      observedAt,
      homeId: 'a',
      awayId: 'b',
      source: 'openfootball',
      status,
      kickoff: '2026-01-01T12:00:00Z',
      homeScore,
      awayScore: homeScore === null ? null : 0,
      resultPeriod: 'regulation',
    });
    const changes = [
      rev('2026-01-01T15:00:00Z', 1),
      rev('2026-01-03T12:00:00Z', 0),
      rev('2026-01-05T12:00:00Z', null, 'scheduled'),
      rev('2026-01-07T12:00:00Z', 2),
    ];
    const row: Match = {
      ...template,
      ...changes.at(-1)!,
      id: 'first',
      resultObservedAt: changes.at(-1)!.observedAt,
      resultRevisions: changes,
    };
    const duplicated = {
      ...row,
      resultRevisions: changes.flatMap((r) => [
        r,
        { ...r, observedAt: new Date(Date.parse(r.observedAt) + 3600_000).toISOString() },
      ]),
    };
    const next: Match = {
      ...template,
      id: 'next',
      homeId: 'b',
      awayId: 'c',
      kickoff: '2026-01-02T12:00:00Z',
      status: 'finished',
      homeScore: 1,
      awayScore: 0,
      source: 'openfootball',
      resultPeriod: 'regulation',
      resultObservedAt: '2026-01-02T15:00:00Z',
      resultRevisions: [],
    };
    for (const cutoff of ['2026-01-02', '2026-01-04', '2026-01-06', '2026-01-08']) {
      const a = eloHistory([row, next], cutoff);
      const b = eloHistory([duplicated, next], cutoff);
      expect(b.ratings).toEqual(a.ratings);
      expect(b.history.map((entry) => ({ ...entry, at: undefined }))).toEqual(
        a.history.map((entry) => ({ ...entry, at: undefined })),
      );
    }
  });
});
