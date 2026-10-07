import { SearchPage } from '@/features/search/search';
import { getDataset } from '@/services/football';
import { searchSource } from '@/services/search-index';
import { seoMetadata } from '@/lib/seo';
export const metadata = seoMetadata(
  '/favoris',
  'Mes favoris',
  'Retrouvez les équipes et matchs enregistrés dans ce navigateur, et gérez vos notifications locales sur Proba Match.',
  false,
);
export default async function Page() {
  return (
    <SearchPage
      data={searchSource(await getDataset())}
      initialResults={{ results: [], total: 0 }}
      favorites
    />
  );
}
