import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyAdminSession } from '@/lib/auth';
export const metadata = {
  title: 'Performance du modèle — Administration',
  robots: { index: false, follow: false },
};
import { getDataset } from '@/services/football';
import { getEvaluations } from '@/services/predictions';
import { walkForwardBacktest } from '@/prediction-engine/backtest';
import { Performance } from '@/features/performance/performance';
import { cache } from '@/services/cache';
import { MODEL_VERSION } from '@/prediction-engine';
import { performanceView } from '@/services/performance-view';
export default async function Page() {
  if (!verifyAdminSession((await cookies()).get('ms-admin')?.value)) redirect('/admin');
  const data = await getDataset();
  const demo = data.source === 'demo';
  const rows = demo
    ? await cache.get(
        `backtest:${MODEL_VERSION}:${data.updatedAt.slice(0, 10)}`,
        async () => walkForwardBacktest(data.matches),
        3_600_000,
      )
    : await getEvaluations();
  const view = performanceView(data, rows);
  return (
    <Performance data={view.data} rows={view.rows} nonEvaluable={view.nonEvaluable} demo={demo} />
  );
}
