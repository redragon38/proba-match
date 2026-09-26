import Link from 'next/link';
import { redirect } from 'next/navigation';
import { publicMetadata } from '@/lib/seo';
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
import { Empty } from '@/components/ui';
export const metadata = publicMetadata('/matchs');
export const dynamic = 'force-dynamic';
export default async function Matches({ searchParams }: { searchParams: Promise<MatchQuery> }) {
  const q = await searchParams;
  if (q.statut === 'favorites') redirect('/favoris');
  const data = await getDataset();
  let selection;
  try {
    selection = matchSelection(data, q);
  } catch {
    return (
      <div className="page">
        <h1>Tous les matchs</h1>
        <Empty text="Filtres invalides. Revenez au calendrier pour choisir une autre sélection." />
        <Link href="/matchs">Revenir aux matchs</Link>
      </div>
    );
  }
  const view = { ...dashboardDataset(data, dateKey()), matches: selection.matches };
  return (
    <Dashboard
      key={JSON.stringify(q)}
      full
      data={view}
      predictions={await getPredictions(view)}
      initialDate={q.date ?? dateKey()}
      initialStatus={selection.status}
      pagination={{ total: selection.total, page: selection.page, pages: selection.pages }}
      upcomingMatches={upcomingSelection(data)}
    />
  );
}
