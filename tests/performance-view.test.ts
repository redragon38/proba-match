import { expect, it } from 'vitest';
import { performanceView } from '@/services/performance-view';
import { createDemoDataset } from '@/services/football/providers/mock';
import { predictionEngine } from '@/prediction-engine';
import { metrics } from '@/prediction-engine/evaluation';

it('preserves all evaluation metrics while removing unrelated historical payloads', () => {
  const data = createDemoDataset(new Date('2026-09-11T12:00:00Z'));
  const target = data.matches.find((m) => m.id === 'demo-0-2')!;
  const prediction = predictionEngine.predict(target, data.matches, '2026-09-11T12:00:00Z')!;
  const rows = [
    {
      prediction,
      homeScore: 1,
      awayScore: 0,
      competitionId: target.competitionId,
      kickoff: target.kickoff,
    },
  ];
  const finished = data.matches.filter((m) => m.status === 'finished');
  data.matches.push(
    ...Array.from({ length: 2000 }, (_, i) => ({
      ...finished[0],
      id: 'unrelated-' + i,
      events: [],
      statistics: [],
      lineups: [],
      resultRevisions: [
        {
          observedAt: '2026-09-01T00:00:00Z',
          homeId: finished[0].homeId,
          awayId: finished[0].awayId,
          kickoff: finished[0].kickoff,
          status: 'finished' as const,
          source: 'openfootball' as const,
          homeScore: 1,
          awayScore: 0,
          resultPeriod: 'regulation' as const,
          note: 'x'.repeat(5000),
        },
      ],
    })),
  );
  const view = performanceView(data, rows);
  expect(metrics(view.rows)).toEqual(metrics(rows));
  expect(view.nonEvaluable).toBe(
    data.matches.filter((m) => m.status === 'finished' && m.id !== target.id).length,
  );
  expect(view.data.matches.map((m) => m.id)).toEqual([target.id]);
  expect(view.rows[0].prediction.inputArchive).toBeUndefined();
  expect(JSON.stringify(view)).not.toContain('resultRevisions');
  expect(JSON.stringify(view).length).toBeLessThan(JSON.stringify(data).length / 100);
  expect(prediction.inputArchive).toBeDefined();
});
