import { notFound } from 'next/navigation';
import { getDataset } from '@/services/football';
import { TeamProfile } from '@/features/profiles/team-profile';
import { JsonLd } from '@/components/json-ld';
import { seoMetadata, absoluteUrl } from '@/lib/seo';
import { teamDataset } from '@/services/football/read-model';
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = await getDataset();
  const t = d.teams.find((t) => t.slug === slug);
  if (!t) notFound();
  return seoMetadata(
    `/equipe/${slug}`,
    `${t.name} — résultats et statistiques`,
    `Calendrier, résultats et forme récente de ${t.name}. Retrouvez les matchs, le classement et les statistiques disponibles sur Proba Match.`,
    d.source !== 'demo' &&
      d.matches.filter((m) => m.homeId === t.id || m.awayId === t.id).length >= 5,
  );
}
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getDataset();
  const team = data.teams.find((t) => t.slug === slug);
  if (!team) notFound();
  return (
    <>
      {data.source !== 'demo' && (
        <JsonLd
          value={{
            '@context': 'https://schema.org',
            '@type': 'SportsTeam',
            name: team.name,
            sport: 'Football',
            url: absoluteUrl(`/equipe/${team.slug}`),
            logo: team.logo ? absoluteUrl(team.logo) : undefined,
          }}
        />
      )}
      <TeamProfile data={teamDataset(data, [team.id])} team={team} />
    </>
  );
}
