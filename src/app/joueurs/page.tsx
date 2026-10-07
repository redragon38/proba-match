import { catalogueQuery, type QueryValue } from '@/lib/catalogue-query';
import { Catalog } from '@/features/profiles/catalog';
import { getDataset } from '@/services/football';
import { catalogueMetadata } from '@/lib/seo';
import { cataloguePage } from '@/services/seo';
import { catalogDataset } from '@/services/football/read-model';
import { normalizeSearch, tolerantNameMatch } from '@/services/search-index';
type Props = { searchParams: Promise<{ page?: QueryValue; q?: QueryValue }> };
const filtered = (data: Awaited<ReturnType<typeof getDataset>>, q = '') =>
  data.players.filter((r) =>
    tolerantNameMatch(normalizeSearch(r.name), normalizeSearch(q.slice(0, 100))),
  );
export async function generateMetadata({ searchParams }: Props) {
  const [data, rawQuery] = await Promise.all([getDataset(), searchParams]);
  const query = catalogueQuery(rawQuery);
  const page = cataloguePage(query.page, filtered(data, query.q).length);
  return catalogueMetadata(
    '/joueurs',
    filtered(data, query.q).length,
    page,
    data.source !== 'demo',
    query.q,
  );
}
export default async function Page({ searchParams }: Props) {
  const [data, rawQuery] = await Promise.all([getDataset(), searchParams]);
  const query = catalogueQuery(rawQuery);
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
