import { Catalog } from '@/features/profiles/catalog';
import { getDataset } from '@/services/football';
import { catalogueMetadata } from '@/lib/seo';
import { cataloguePage } from '@/services/seo';
import { catalogDataset } from '@/services/football/read-model';
import { normalizeSearch } from '@/services/search-index';
type Props = { searchParams: Promise<{ page?: string; q?: string }> };
const filtered = (data: Awaited<ReturnType<typeof getDataset>>, q = '') =>
  data.players.filter((r) => normalizeSearch(r.name).includes(normalizeSearch(q.slice(0, 100))));
export async function generateMetadata({ searchParams }: Props) {
  const [data, query] = await Promise.all([getDataset(), searchParams]);
  const page = cataloguePage(query.page, filtered(data, query.q).length);
  return catalogueMetadata(
    '/joueurs',
    data.players.length,
    page,
    data.source !== 'demo' && !query.q,
  );
}
export default async function Page({ searchParams }: Props) {
  const [data, query] = await Promise.all([getDataset(), searchParams]);
  const page = cataloguePage(query.page, filtered(data, query.q).length);
  const rows = filtered(data, query.q);
  const display = catalogDataset(data);
  display.players = rows.slice((page - 1) * 24, page * 24);
  const ids = new Set(display.players.map((p) => p.teamId));
  display.teams = data.teams.filter((t) => ids.has(t.id));
  display.competitions = [];
  return (
    <Catalog
      key={`${page}:${query.q ?? ''}`}
      data={display}
      total={rows.length}
      initialSearch={query.q?.slice(0, 100) ?? ''}
      kind="players"
      initialPage={page}
    />
  );
}
