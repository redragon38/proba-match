import { publicMetadata } from '@/lib/seo';
export const metadata = publicMetadata('/matchs');
import { Dashboard } from '@/features/matches/dashboard';
import { getDataset } from '@/services/football';
import { getPredictions } from '@/services/predictions';
import { dateKey } from '@/lib/format';
import { dashboardDataset } from '@/services/football/read-model';
export const dynamic = 'force-dynamic';
export default async function Matches({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; statut?: string }>;
}) {
  const q = await searchParams;
  const data = await getDataset();
  const date =
    q.date && /^\d{4}-\d{2}-\d{2}$/.test(q.date) && Number.isFinite(new Date(q.date).getTime())
      ? q.date
      : dateKey();
  return (
    <Dashboard
      key={`${date}-${q.statut}`}
      full
      data={dashboardDataset(data, date)}
      predictions={await getPredictions(data)}
      initialDate={date}
      automaticDate={!q.date}
      initialStatus={q.statut}
    />
  );
}
