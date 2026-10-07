import { catalogueQuery, type QueryValue } from '@/lib/catalogue-query';
import { Catalog } from '@/features/profiles/catalog';
import { getDataset } from '@/services/football';
import { catalogueMetadata } from '@/lib/seo';
import { cataloguePage } from '@/services/seo';
import { catalogDataset } from '@/services/football/read-model';
type Props = { searchParams: Promise<{ page?: QueryValue }> };
export async function generateMetadata({ searchParams }: Props) {
  const [data, rawQuery] = await Promise.all([getDataset(), searchParams]);
  const query = catalogueQuery(rawQuery);
  const page = cataloguePage(query.page, data.competitions.length);
  return catalogueMetadata('/competitions', data.competitions.length, page, data.source !== 'demo');
}
export default async function Page({ searchParams }: Props) {
  const [data, rawQuery] = await Promise.all([getDataset(), searchParams]);
  const query = catalogueQuery(rawQuery);
  const page = cataloguePage(query.page, data.competitions.length);
  return (
    <Catalog
      key={page}
      data={{ ...catalogDataset(data), players: [], teams: [] }}
      kind="competitions"
      initialPage={page}
    />
  );
}
