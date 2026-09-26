import { Settings } from '@/components/settings';
import { getDataset } from '@/services/football';
export const metadata = { title: 'Paramètres', robots: { index: false } };
export default async function Page() {
  const data = await getDataset();
  return (
    <Settings competitions={data.competitions.map(({ id, name, flag }) => ({ id, name, flag }))} />
  );
}
