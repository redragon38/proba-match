import { cache } from '@/services/cache';
import { getDataset } from '@/services/football';
import { getEvaluations } from '@/services/predictions';
import { walkForwardBacktest } from '@/prediction-engine/backtest';
import { MODEL_VERSION } from '@/prediction-engine';
import { Performance } from '@/features/performance/performance';
import { publicMetadata } from '@/lib/seo';
import { performanceView } from '@/services/performance-view';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const data = await getDataset();
  return publicMetadata(
    '/bilan-predictions',
    Boolean(process.env.DATABASE_URL) && data.source !== 'demo',
  );
}

export default async function PredictionReportPage() {
  const data = await getDataset();
  const demo = data.source === 'demo';
  const rows = demo
    ? await cache.get(
        `public-backtest:${MODEL_VERSION}:${data.updatedAt.slice(0, 10)}`,
        async () => walkForwardBacktest(data.matches),
        3_600_000,
      )
    : await getEvaluations();
  const view = performanceView(data, rows);
  return (
    <Performance
      data={view.data}
      rows={view.rows}
      nonEvaluable={view.nonEvaluable}
      demo={demo}
      publicReport
    />
  );
}
