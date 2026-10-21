import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { createDemoDataset } from '@/services/football/providers/mock';
import { walkForwardBacktest } from '@/prediction-engine/backtest';
import { prepareReport } from '@/features/performance/report-view';
import { Performance } from '@/features/performance/performance';
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('next/link', () => ({ default: 'a' }));

it('server report renders twenty archive links, global counts and Paris dates around midnight', () => {
  const data = createDemoDataset(new Date('2026-10-21T12:00:00Z'));
  const rows = walkForwardBacktest(data.matches);
  rows[0].kickoff = '2026-10-19T23:30:00Z';
  const report = prepareReport(rows, data, {});
  const html = renderToStaticMarkup(
    createElement(Performance, { ...report, demo: false, publicReport: true }),
  );
  expect(html).toContain('20/10/2026');
  expect(html).toContain(`${rows.length} prédictions initiales enregistrées`);
  expect(html.match(/href="\/match\//g)).toHaveLength(20);
});
