import { notFound, permanentRedirect } from 'next/navigation';
import { seoMetadata } from '@/lib/seo';
import { competitionView } from '@/services/competition-view';
import { getDataset } from '@/services/football';
import { CompetitionProfile } from '@/features/profiles/competition-profile';
const aliases: Record<string, string> = {
  'ligue-1': '61',
  'premier-league': '39',
  'la-liga': '140',
  'serie-a': '135',
  bundesliga: '78',
  'ligue-des-champions': '2',
};
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ saison?: string }>;
}) {
  const { slug } = await params;
  const d = await getDataset();
  const c = d.competitions.find((c) => c.slug === slug || c.id === aliases[slug]);
  if (!c) notFound();
  const query = await searchParams;
  return seoMetadata(
    `/competition/${c.slug}`,
    `${c.name} — classement et calendrier`,
    `Suivez ${c.name} : classement, résultats, prochaines rencontres et équipes. Consultez les saisons disponibles dans le catalogue Proba Match.`,
    d.source !== 'demo' && !query.saison && d.matches.some((m) => m.competitionId === c.id),
  );
}
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ saison?: string; statut?: string }>;
}) {
  const { slug } = await params;
  const data = await getDataset();
  const c = data.competitions.find((c) => c.slug === slug || c.id === aliases[slug]);
  if (!c) notFound();
  if (slug !== c.slug) permanentRedirect(`/competition/${c.slug}`);
  return <CompetitionProfile view={competitionView(data, c, await searchParams)} />;
}
