import { SearchPage } from '@/features/search/search';
import { getDataset } from '@/services/football';
import { searchSource } from '@/services/search-index';
export const metadata = { title: 'Mes favoris', robots: { index: false, follow: true } };
export default async function Page() {
  return (
    <SearchPage
      data={searchSource(await getDataset())}
      initialResults={{ results: [], total: 0 }}
      favorites
    />
  );
}
