import { Catalog } from '@/features/profiles/catalog';
import { getDataset } from '@/services/football';
import { catalogueMetadata } from '@/lib/seo';
import { cataloguePage } from '@/services/seo';
import { catalogDataset } from '@/services/football/read-model';
type Props = { searchParams: Promise<{ page?: string }> };
export async function generateMetadata({ searchParams }: Props) {
  const [data, query] = await Promise.all([getDataset(), searchParams]);
  const page = cataloguePage(query.page, data.teams.length);
  return catalogueMetadata('/equipes', data.teams.length, page, data.source !== 'demo');
}
export default async function Page({ searchParams }: Props) {
  const [data, query] = await Promise.all([getDataset(), searchParams]);
  const page = cataloguePage(query.page, data.teams.length);
  return <Catalog key={page} data={catalogDataset(data)} kind="teams" initialPage={page} />;
}
