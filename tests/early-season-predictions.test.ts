import { expect, it } from 'vitest';
import { PredictionEngine } from '@/prediction-engine';
import { createDemoDataset } from '@/services/football/providers/mock';
import type { Match } from '@/types/football';

it('recovers an early-season forecast with real prior-season inputs without lowering sample requirements', () => {
  // Synthetic regression fixture; no result or probability is a production claim.
  const now = new Date('2026-10-20T12:00:00Z');
  const base = createDemoDataset(now).matches[0];
  const target: Match = {
    ...base,
    id: 'target',
    status: 'scheduled',
    homeId: 'home',
    awayId: 'away',
    kickoff: '2026-10-23T18:45:00Z',
    kickoffKnown: true,
    homeScore: null,
    awayScore: null,
    lineups: [],
  };
  const histories = (season: number, count: number, end: string) =>
    ['home', 'away'].flatMap((teamId) =>
      Array.from({ length: count }, (_, i): Match => ({
        ...base,
        id: `${season}-${teamId}-${i}`,
        source: 'openfootball',
        season,
        homeId: i % 2 ? `opponent-${i}` : teamId,
        awayId: i % 2 ? teamId : `opponent-${i}`,
        status: 'finished',
        homeScore: 2,
        awayScore: 1,
        resultPeriod: 'regulation',
        scoreBreakdown: undefined,
        resultRevisions: [],
        kickoff: new Date(Date.parse(end) - i * 7 * 86400_000).toISOString(),
        resultObservedAt: '2026-10-20T11:59:00Z',
      })),
    );
  const current = histories(2026, 5, '2026-09-20T12:00:00Z');
  const previous = histories(2025, 15, '2026-05-20T12:00:00Z');
  const engine = new PredictionEngine();
  expect(engine.predict(target, current, now.toISOString())).toBeNull();
  const prediction = engine.predict(target, [...current, ...previous], now.toISOString());
  expect(prediction).not.toBeNull();
  expect(prediction!.effectiveSample).toBeGreaterThanOrEqual(5);
  expect(prediction!.sample).toBe(20);
  expect(prediction!.createdAt).toBe(now.toISOString());
  // Imported results cannot retroactively become information available yesterday.
  expect(engine.predict(target, [...current, ...previous], '2026-10-19T12:00:00Z')).toBeNull();
});
