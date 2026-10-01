import { notFound, permanentRedirect } from 'next/navigation';
import { seoMetadata, matchIndexable } from '@/lib/seo';
import { teamDataset } from '@/services/football/read-model';
import { getDataset } from '@/services/football';
import { getPredictions, getPredictionHistory } from '@/services/predictions';
import { MatchDetail } from '@/features/matches/match-detail';
import { informationQuality, predictionExplanation, predictionInsights } from '@/prediction-engine/insights';
import { JsonLd } from '@/components/json-ld';
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getDataset();
  const m = data.matches.find((m) => m.slug === id || m.id === id);
  if (!m) notFound();
  const title = `${data.teams.find((t) => t.id === m.homeId)?.name} – ${data.teams.find((t) => t.id === m.awayId)?.name}`;
  const date = new Date(m.kickoff).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' });
  return seoMetadata(
    `/match/${m.slug}`,
    `${title} — ${date}`,
    `Résultat, forme des équipes et données disponibles pour ${title}, le ${date}. Consultez les statistiques et les projections Proba Match.`,
    data.source !== 'demo' && matchIndexable(m),
  );
}
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ onglet?: string }>;
}) {
  const [{ id }, q, data] = await Promise.all([params, searchParams, getDataset()]);
  const m = data.matches.find((m) => m.id === id || m.slug === id);
  if (!m) notFound();
  if (id !== m.slug)
    permanentRedirect(
      `/match/${m.slug}${q.onglet ? `?onglet=${encodeURIComponent(q.onglet)}` : ''}`,
    );
  const history = await getPredictionHistory(m.id, data.source);
  const prediction = data.source === 'demo'
    ? (await getPredictions(data))[m.id]
    : history.at(-1);
  const allowed = [
    'apercu',
    'prediction',
    'statistiques',
    'compositions',
    'evenements',
    'h2h',
    'joueurs',
  ];
  return (
    <>
      {data.source !== 'demo' && (
        <JsonLd
          value={{
            '@context': 'https://schema.org',
            '@type': 'SportsEvent',
            name: `${data.teams.find((t) => t.id === m.homeId)?.name} – ${data.teams.find((t) => t.id === m.awayId)?.name}`,
            startDate: m.kickoffKnown === false ? m.sourceDate : m.kickoff,
            sport: 'Football',
            eventStatus:
              m.status === 'cancelled'
                ? 'https://schema.org/EventCancelled'
                : m.status === 'postponed'
                  ? 'https://schema.org/EventPostponed'
                  : 'https://schema.org/EventScheduled',
            location: m.venue ? { '@type': 'Place', name: m.venue } : undefined,
            homeTeam: {
              '@type': 'SportsTeam',
              name: data.teams.find((t) => t.id === m.homeId)?.name,
            },
            awayTeam: {
              '@type': 'SportsTeam',
              name: data.teams.find((t) => t.id === m.awayId)?.name,
            },
          }}
        />
      )}
      <MatchDetail
        data={teamDataset(data, [m.homeId, m.awayId])}
        match={m}
        history={history}
        prediction={prediction}
        analysis={prediction ? predictionInsights(prediction) : undefined}
        explanation={prediction ? predictionExplanation(prediction, data.teams.find((t) => t.id === m.homeId)?.name ?? 'domicile', data.teams.find((t) => t.id === m.awayId)?.name ?? 'extérieur') : undefined}
        quality={prediction ? informationQuality(prediction, data.degraded) : undefined}
        tab={q.onglet && allowed.includes(q.onglet) ? q.onglet : 'apercu'}
      />
    </>
  );
}
