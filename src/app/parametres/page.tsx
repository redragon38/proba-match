import { Settings } from '@/components/settings';
import { getDataset } from '@/services/football';
import { seoMetadata } from '@/lib/seo';
export const metadata = seoMetadata(
  '/parametres',
  'Paramètres',
  'Personnalisez l’affichage, les compétitions suivies et les préférences locales de votre navigateur sur Proba Match.',
  false,
);
export default async function Page() {
  const data = await getDataset();
  return (
    <Settings competitions={data.competitions.map(({ id, name, flag }) => ({ id, name, flag }))} />
  );
}
