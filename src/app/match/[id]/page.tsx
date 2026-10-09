import { matchStructuredData } from '@/lib/sports-structured-data';
import { notFound, permanentRedirect } from 'next/navigation';
import { seoMetadata, matchIndexable } from '@/lib/seo';
import { teamDataset } from '@/services/football/read-model';
import { getDataset } from '@/services/football';
import {
  computeDisplayPrediction,
  getPredictionHistory,
  getPredictions,
} from '@/services/predictions';
import { MatchDetail } from '@/features/matches/match-detail';
import { informationQuality, predictionInsights } from '@/prediction-engine/insights';
import { JsonLd } from '@/components/json-ld';
import { matchFactSummary, matchDateLabel } from '@/lib/match-facts';
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getDataset();
  const m = data.matches.find((m) => m.slug === id || m.id === id);
  if (!m) notFound();
  const title = `${data.teams.find((t) => t.id === m.homeId)?.name} – ${data.teams.find((t) => t.id === m.awayId)?.name}`;
  const date = matchDateLabel(m, false) ?? 'date à confirmer';
  return seoMetadata(
    `/match/${m.slug}`,
    `${title} — ${date}`,
    matchFactSummary(
      m,
      data.teams.find((t) => t.id === m.homeId)?.name ?? 'Domicile',
      data.teams.find((t) => t.id === m.awayId)?.name ?? 'Extérieur',
      data.competitions.find((c) => c.id === m.competitionId)?.name ?? 'Football',
    ),
    data.source !== 'demo' && matchIndexable(m, data),
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
  const structured = data.source !== 'demo' ? matchStructuredData(m, data) : null;
  const history = await getPredictionHistory(m.id, data.source);
  const archivedPrediction = history.at(-1);
  const computedPrediction =
    data.source === 'demo' ? (await getPredictions(data))[m.id] : computeDisplayPrediction(m, data);
  const prediction = archivedPrediction ?? computedPrediction;
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
      {structured && <JsonLd value={structured} />}
      <MatchDetail
        data={teamDataset(data, [m.homeId, m.awayId])}
        match={m}
        history={history}
        prediction={prediction}
        predictionArchived={Boolean(archivedPrediction)}
        analysis={prediction ? predictionInsights(prediction) : undefined}
        quality={prediction ? informationQuality(prediction, data.degraded) : undefined}
        tab={q.onglet && allowed.includes(q.onglet) ? q.onglet : 'apercu'}
      />
    </>
  );
}
