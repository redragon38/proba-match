import { expect, it } from 'vitest';
import { markdownReport, monitorState } from '../scripts/seo-report.mjs';
it('deduplicates unchanged failures but reports recovery and supports priority filters', () => {
  const report = {
    generatedAt: '2026-10-21',
    base: 'https://example.test',
    scope: { truncated: true },
    pages: [],
    checks: [
      { category: 'routes', status: 'FAIL', detail: '/x HTTP 503' },
      { category: 'performance', status: 'WARNING', detail: 'Large page' },
    ],
    external: 'NON VÉRIFIÉ EXTERNEMENT',
  };
  const first = monitorState(report);
  expect(first.changed).toBe(true);
  expect(monitorState(report, first).changed).toBe(false);
  expect(monitorState({ ...report, generatedAt: 'another time' }, first).changed).toBe(false);
  expect(monitorState({ ...report, checks: [] }, first).changed).toBe(true);
  expect(monitorState({ ...report, checks: [], completed: false }).failures).toBe(1);
  expect(markdownReport(report, 'P0')).toContain('/x HTTP 503');
  expect(markdownReport(report, 'P0')).not.toContain('Large page');
});
