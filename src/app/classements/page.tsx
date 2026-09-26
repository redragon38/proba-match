import { publicMetadata } from '@/lib/seo';
import { Standings } from '@/features/profiles/standings';
import { getDataset } from '@/services/football';
import { standingsView } from '@/services/football/read-model';
export const metadata = publicMetadata('/classements');
export default async function Page() {
  return <Standings {...standingsView(await getDataset())} />;
}
