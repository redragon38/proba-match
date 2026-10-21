import { cache } from '@/services/cache';
import { getDataset } from '@/services/football';
import { getPublicEvaluations } from '@/services/predictions';
import { prepareReport } from '@/features/performance/report-view';
import { walkForwardBacktest } from '@/prediction-engine/backtest';
import { MODEL_VERSION } from '@/prediction-engine';
import { Performance } from '@/features/performance/performance';
import { publicMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const data = await getDataset();
  return publicMetadata(
    '/bilan-predictions',
    Boolean(process.env.DATABASE_URL) && data.source !== 'demo',
  );
}

export default async function PredictionReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const data = await getDataset();
  const demo = data.source === 'demo';
  const rows = demo
    ? await cache.get(
        `public-backtest:${MODEL_VERSION}:${data.updatedAt.slice(0, 10)}`,
        async () => walkForwardBacktest(data.matches),
        3_600_000,
      )
    : await getPublicEvaluations();
  const report = prepareReport(rows, data, await searchParams);
  return (
    <Performance
      data={report.data}
      rows={report.rows}
      summary={report.summary}
      demo={demo}
      publicReport
    />
  );
}
