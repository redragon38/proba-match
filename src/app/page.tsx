import { publicMetadata } from '@/lib/seo';
export const metadata = publicMetadata('/');
import { Dashboard } from '@/features/matches/dashboard';
import { getDataset } from '@/services/football';
import { getPredictions } from '@/services/predictions';
import { dateKey } from '@/lib/format';
import { dashboardDataset } from '@/services/football/read-model';
import { upcomingSelection } from '@/services/football/match-selection';
import { HomeInsights } from '@/features/matches/home-insights';
export const dynamic = 'force-dynamic';
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; statut?: string }>;
}) {
  const query = await searchParams;
  const data = await getDataset();
  const predictions = await getPredictions(data);
  const date =
    query.date &&
    /^\d{4}-\d{2}-\d{2}$/.test(query.date) &&
    Number.isFinite(new Date(query.date).getTime())
      ? query.date
      : dateKey();
  return (
    <>
      <Dashboard
        key={`${date}-${query.statut}`}
        data={dashboardDataset(data, date)}
        predictions={predictions}
        initialDate={date}
        automaticDate={!query.date}
        initialStatus={query.statut}
        upcomingMatches={upcomingSelection(data)}
      />
      <HomeInsights data={data} predictions={predictions} />
    </>
  );
}
