import { notFound } from 'next/navigation';
import { getDataset } from '@/services/football';
import { TeamProfile } from '@/features/profiles/team-profile';
import { JsonLd } from '@/components/json-ld';
import { teamStructuredData } from '@/lib/sports-structured-data';
import { teamFactSummary } from '@/lib/team-facts';
import { seoMetadata } from '@/lib/seo';
import { teamDataset } from '@/services/football/read-model';
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = await getDataset();
  const t = d.teams.find((t) => t.slug === slug);
  if (!t) notFound();
  return seoMetadata(
    `/equipe/${slug}`,
    `${t.name} — résultats et statistiques`,
    teamFactSummary(t, d),
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
      {data.source !== 'demo' && <JsonLd value={teamStructuredData(team)} />}
      <TeamProfile
        data={teamDataset(data, [team.id])}
        team={team}
        summary={data.source !== 'demo' ? teamFactSummary(team, data) : undefined}
      />
    </>
  );
}
