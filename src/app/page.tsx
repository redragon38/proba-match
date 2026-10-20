import { publicMetadata } from '@/lib/seo';
import { isoDate } from '@/lib/factual-dates';
import Link from 'next/link';
import { SourceBanner } from '@/components/source-banner';
export const metadata = publicMetadata('/');
import { Dashboard } from '@/features/matches/dashboard';
import { getDataset } from '@/services/football';
import { getPredictions } from '@/services/predictions';
import { dashboardDataset } from '@/services/football/read-model';
import { closestMatchDate, upcomingSelection } from '@/services/football/match-selection';
import { HomeInsights } from '@/features/matches/home-insights';
import { publicPredictionIds } from '@/services/prediction-visibility';
import { homePredictionCandidates } from '@/services/football/home-predictions';
export const dynamic = 'force-dynamic';
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; statut?: string }>;
}) {
  const query = await searchParams;
  const data = await getDataset();
  if (!data.matches.length)
    return (
      <main className="page">
        <SourceBanner data={data} />
        <h1>Matchs de football : scores, calendrier et analyses</h1>
        <section className="card padded">
          <h2>Les rencontres ne sont pas disponibles pour le moment</h2>
          <p>
            Retrouvez ici les résultats et les probabilités lorsque des données vérifiées seront
            disponibles. En attendant, découvrez comment lire nos estimations.
          </p>
          <Link className="button" href="/comprendre-probabilites">
            Lire le guide →
          </Link>
          <p>
            <Link className="text-link" href="/sources-donnees">
              Sources et couverture des données
            </Link>
          </p>
        </section>
      </main>
    );
  const date = isoDate(query.date) ?? closestMatchDate(data, query.statut);
  const upcomingMatches = upcomingSelection(data);
  const view = dashboardDataset(data, date, upcomingMatches);
  // Request every archived forecast shown by the dashboard so a match has the
  // same public prediction here and in the complete calendar.
  // Keep archived forecasts visible while a delayed provider still reports the
  // fixture as scheduled. Other pages select predictions by match identity too;
  // filtering here by the wall clock caused the same match to disagree by page.
  const dashboardIds = publicPredictionIds(view.matches);
  const insightMatches = homePredictionCandidates(data);
  const visibleIds = new Set([...dashboardIds, ...insightMatches.map((match) => match.id)]);
  const predictions = await getPredictions(data, visibleIds, false);
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
