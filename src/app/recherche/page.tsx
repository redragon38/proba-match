import { SearchPage } from '@/features/search/search';
import { getDataset } from '@/services/football';
import { searchResults, searchSource } from '@/services/search-index';
import { seoMetadata } from '@/lib/seo';
export const metadata = seoMetadata(
  '/recherche',
  'Recherche football',
  'Recherchez une équipe, un joueur, une compétition ou une rencontre dans le catalogue disponible de Proba Match.',
  false,
);
export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const [data, params] = await Promise.all([getDataset(), searchParams]);
  const q = params.q?.slice(0, 100) ?? '';
  return (
    <SearchPage
      key={q}
      data={searchSource(data)}
      initialResults={searchResults(data, { q })}
      initialQ={q}
    />
  );
}
