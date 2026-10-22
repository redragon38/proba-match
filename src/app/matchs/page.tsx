import { redirect, notFound } from 'next/navigation';
import { catalogueMetadata, seoMetadata, publicPages } from '@/lib/seo';
import { Dashboard } from '@/features/matches/dashboard';
import { getDataset } from '@/services/football';
import { getPredictions } from '@/services/predictions';
import { dateKey } from '@/lib/format';
import { dashboardDataset } from '@/services/football/read-model';
import {
  matchSelection,
  upcomingSelection,
  type MatchQuery,
} from '@/services/football/match-selection';
export const dynamic = 'force-dynamic';
export async function generateMetadata({ searchParams }: { searchParams: Promise<MatchQuery> }) {
  const q = await searchParams;
  if (q.statut === 'favorites') redirect('/favoris');
  const data = await getDataset();
  let selection;
  try {
    selection = matchSelection(data, q);
  } catch {
    notFound();
  }
  if (q.page && Number(q.page) > selection.pages) notFound();
  const filtered =
    (q.statut ?? q.status ?? 'all') !== 'all' ||
    Boolean(q.date || q.competition || q.pays || q.timezone || q.limit);
  if (filtered) return seoMetadata('/matchs', ...publicPages['/matchs'], false);
  return catalogueMetadata('/matchs', selection.total, selection.page, data.source !== 'demo');
}
export default async function Matches({ searchParams }: { searchParams: Promise<MatchQuery> }) {
  const q = await searchParams;
  if (q.statut === 'favorites') redirect('/favoris');
  const data = await getDataset();
  let selection;
  try {
    selection = matchSelection(data, q);
  } catch {
    notFound();
  }
  if (q.page && Number(q.page) > selection.pages) notFound();
  const view = {
    ...dashboardDataset(data, dateKey(), selection.matches),
    matches: selection.matches,
  };
  return (
    <Dashboard
      key={JSON.stringify(q)}
      full
      data={view}
      predictions={await getPredictions(view, undefined, false)}
      initialDate={q.date ?? dateKey(new Date(), q.timezone ?? 'Europe/Paris')}
      serverToday={dateKey(new Date(), q.timezone ?? 'Europe/Paris')}
      initialStatus={selection.status}
      pagination={{ total: selection.total, page: selection.page, pages: selection.pages }}
      upcomingMatches={upcomingSelection(data)}
    />
  );
}
