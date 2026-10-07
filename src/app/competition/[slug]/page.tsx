import { competitionSeason } from '@/lib/competition-season';
import { competitionQuery, competitionAliasTarget, type QueryValue } from '@/lib/catalogue-query';
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
  searchParams: Promise<{ saison?: QueryValue; statut?: QueryValue }>;
}) {
  const { slug } = await params;
  const d = await getDataset();
  const c = d.competitions.find((c) => c.slug === slug || c.id === aliases[slug]);
  if (!c) notFound();
  const query = competitionQuery(await searchParams);
  const requested = Number(query.saison);
  const season =
    requested === c.season ||
    d.matches.some((m) => m.competitionId === c.id && m.season === requested)
      ? requested
      : c.season;
  const label = competitionSeason(c, season);
  return seoMetadata(
    `/competition/${c.slug}`,
    `${c.name} — saison ${label}, classement et calendrier`,
    `Saison ${label} de ${c.name} : classement, résultats et calendrier selon les données disponibles. La couverture du catalogue Proba Match peut être partielle.`,
    d.source !== 'demo' && !query.saison && d.matches.some((m) => m.competitionId === c.id),
  );
}
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ saison?: QueryValue; statut?: QueryValue }>;
}) {
  const { slug } = await params;
  const data = await getDataset();
  const c = data.competitions.find((c) => c.slug === slug || c.id === aliases[slug]);
  if (!c) notFound();
  const query = competitionQuery(await searchParams);
  if (slug !== c.slug) permanentRedirect(competitionAliasTarget(c.slug, query));
  return <CompetitionProfile view={competitionView(data, c, query)} />;
}
