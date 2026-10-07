import { notFound } from 'next/navigation';
import { getDataset } from '@/services/football';
import { Comparator } from '@/features/compare/comparator';
import {
  catalogDataset,
  comparisonView,
  commonComparisonPeriod,
} from '@/services/football/read-model';
import { firstQueryValue, type QueryValue } from '@/lib/catalogue-query';
import { seoMetadata } from '@/lib/seo';
export async function generateMetadata({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!['equipes', 'joueurs'].includes(kind)) notFound();
  return seoMetadata(
    `/comparateur/${kind}`,
    kind === 'equipes' ? 'Comparateur d’équipes football' : 'Comparateur de joueurs football',
    kind === 'equipes'
      ? 'Comparez la forme, les résultats et les moyennes de buts des équipes disponibles, selon le lieu et la période.'
      : 'Comparez les minutes, les statistiques par 90 minutes et les performances descriptives des joueurs disponibles.',
    false,
  );
}
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string }>;
  searchParams: Promise<{ a?: QueryValue; b?: QueryValue; period?: QueryValue }>;
}) {
  const [{ kind }, rawQuery, data] = await Promise.all([params, searchParams, getDataset()]);
  if (!['equipes', 'joueurs'].includes(kind)) notFound();
  const q = {
    a: firstQueryValue(rawQuery.a),
    b: firstQueryValue(rawQuery.b),
    period: firstQueryValue(rawQuery.period),
  };
  const items = kind === 'equipes' ? data.teams : data.players;
  const selectedA = items.some((p) => p.id === q.a) ? q.a : items[0]?.id;
  const selectedB = items.some((p) => p.id === q.b)
    ? q.b
    : items.find((p) => p.id !== selectedA)?.id;
  const periodMode = q.period === 'common' ? 'common' : 'catalogue';
  const common = commonComparisonPeriod(data, selectedA ?? '', selectedB ?? '');
  const comparisonData = periodMode === 'common' ? common.data : data;
  const display = catalogDataset(data);
  display.players =
    kind === 'joueurs' ? data.players.filter((p) => [selectedA, selectedB].includes(p.id)) : [];
  if (kind === 'joueurs') {
    const ids = new Set(display.players.map((p) => p.teamId));
    display.teams = data.teams.filter((t) => ids.has(t.id));
  }
  return (
    <Comparator
      key={`${kind}:${selectedA}:${selectedB}:${periodMode}`}
      data={display}
      playerChoices={
        kind === 'joueurs'
          ? data.players.map((p) => ({
              id: p.id,
              name: `${p.name} — ${data.teams.find((t) => t.id === p.teamId)?.short ?? ''}`,
            }))
          : undefined
      }
      summaries={kind === 'equipes' ? comparisonView(comparisonData) : {}}
      kind={kind === 'equipes' ? 'teams' : 'players'}
      initialA={selectedA}
      initialB={selectedB}
      periodMode={periodMode}
      commonPeriod={{ from: common.from, to: common.to }}
    />
  );
}
