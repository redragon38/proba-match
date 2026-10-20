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
import { matchSeoCopy } from '@/lib/match-facts';
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getDataset();
  const m = data.matches.find((m) => m.slug === id || m.id === id);
  if (!m) notFound();
  const prediction = (await getPredictions(data, new Set([m.id]), false))[m.id];
  const copy = matchSeoCopy(m, data, Boolean(prediction));
  return seoMetadata(
    `/match/${m.slug}`,
    copy.title,
    copy.description,
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
  const allowed = [
    'apercu',
    'prediction',
    'statistiques',
    'compositions',
    'evenements',
    'h2h',
    'joueurs',
  ];
  const tab = q.onglet && allowed.includes(q.onglet) ? q.onglet : 'apercu';
  // Most match tabs only need the latest forecast. Loading an entire prediction
  // history (whose DB records contain immutable model inputs) made unrelated tabs
  // compete for CPU and memory during concurrent SSR requests.
  const [latest, history] = await Promise.all([
    getPredictions(data, new Set([m.id]), false),
    tab === 'prediction' ? getPredictionHistory(m.id, data.source) : Promise.resolve([]),
  ]);
  const archivedPrediction = history.at(-1);
  const storedPrediction = archivedPrediction ?? latest[m.id];
  // Production forecasts are prepared by the isolated prediction job. Computing
  // one synchronously scans the historical corpus and can block all public SSR
  // requests when several uncached match pages arrive together.
  const prediction =
    storedPrediction ?? (data.source === 'demo' ? computeDisplayPrediction(m, data) : undefined);
  return (
    <>
      {structured && <JsonLd value={structured} />}
      <MatchDetail
        data={teamDataset(data, [m.homeId, m.awayId])}
        match={m}
        history={history}
        prediction={prediction}
        predictionArchived={Boolean(storedPrediction)}
        analysis={prediction ? predictionInsights(prediction) : undefined}
        quality={prediction ? informationQuality(prediction, data.degraded) : undefined}
        tab={tab}
      />
    </>
  );
}
