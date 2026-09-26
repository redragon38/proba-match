import { publicMetadata } from '@/lib/seo';
export const metadata = publicMetadata('/live');
import { getDataset } from '@/services/football';
import { dashboardDataset } from '@/services/football/read-model';
import { dateKey } from '@/lib/format';
import { LivePage } from '@/features/matches/live-page';
export default async function Page() {
  return <LivePage data={dashboardDataset(await getDataset(), dateKey())} />;
}
