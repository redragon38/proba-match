import { expect, it } from 'vitest';
import { createDemoDataset } from '@/services/football/providers/mock';
import { walkForwardBacktest } from '@/prediction-engine/backtest';
import { metrics } from '@/prediction-engine/evaluation';
import { prepareReport } from '@/features/performance/report-view';

it('paginates on the server without changing global metrics, calibration or filters', () => {
  const data = createDemoDataset(new Date('2026-10-21T12:00:00Z'));
  const rows = walkForwardBacktest(data.matches);
  expect(rows.length).toBeGreaterThan(20);
  const report = prepareReport(rows, data, { page: '2' });
  expect(report.rows.map((r) => r.prediction.id)).toEqual(
    rows.slice(20, 40).map((r) => r.prediction.id),
  );
  expect(report.rows.every((r) => !r.prediction.inputArchive)).toBe(true);
  expect(report.summary.stats).toEqual(metrics(rows));
  expect(report.summary.filteredCount).toBe(rows.length);
  expect(report.data.matches.length).toBeLessThanOrEqual(20);
  const selected = prepareReport(rows, data, {
    competition: rows[0].competitionId,
    page: '999999',
  });
  const expected = rows.filter((r) => r.competitionId === rows[0].competitionId);
  expect(selected.summary.stats).toEqual(metrics(expected));
  expect(selected.summary.page).toBe(selected.summary.pageCount);
  const before = Buffer.byteLength(JSON.stringify({ data, rows }));
  const after = Buffer.byteLength(JSON.stringify(report));
  expect(after).toBeLessThan(before / 2);
  console.info(
    'PERFORMANCE_REPORT_PAYLOAD',
    JSON.stringify({ before, after, sample: rows.length, pageSize: report.rows.length }),
  );
});

it('uses the recorded competition season, including calendar-year leagues', () => {
  const data = createDemoDataset(new Date('2026-10-21T12:00:00Z'));
  const rows = walkForwardBacktest(data.matches).slice(0, 1);
  const competition = data.competitions.find((c) => c.id === rows[0].competitionId)!;
  competition.name = 'Major League Soccer';
  rows[0].season = 2026;
  rows[0].kickoff = '2026-03-01T12:00:00Z';
  expect(
    prepareReport(rows, data, {}).summary.breakdowns.find((g) => g.title === 'Par saison')
      ?.entries[0].key,
  ).toBe('2026');
});
