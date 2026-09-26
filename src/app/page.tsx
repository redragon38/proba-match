import { publicMetadata } from '@/lib/seo';
export const metadata = publicMetadata('/');
import { Dashboard } from '@/features/matches/dashboard';
import { getDataset } from '@/services/football';
import { getPredictions } from '@/services/predictions';
import { dashboardDataset } from '@/services/football/read-model';
import { closestMatchDate, upcomingSelection } from '@/services/football/match-selection';
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
      : closestMatchDate(data, query.statut);
  const view = dashboardDataset(data, date);
  const upcomingMatches = upcomingSelection(data);
  const visibleIds = new Set([...view.matches, ...upcomingMatches].map((match) => match.id));
  const dashboardPredictions = Object.fromEntries(
    Object.entries(predictions).filter(([id]) => visibleIds.has(id)),
  );
  return (
    <>
      <Dashboard
        key={`${date}-${query.statut}`}
        data={view}
        predictions={dashboardPredictions}
        initialDate={date}
        automaticDate={!query.date}
        initialStatus={query.statut}
        upcomingMatches={upcomingMatches}
      />
      <HomeInsights data={data} predictions={predictions} />
    </>
  );
}
