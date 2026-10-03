import { notFound } from 'next/navigation';
import { getDataset } from '@/services/football';
import { Comparator } from '@/features/compare/comparator';
import { catalogDataset, comparisonView } from '@/services/football/read-model';
export const metadata = { title: 'Comparateur football', robots: { index: false, follow: true } };
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string }>;
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const [{ kind }, q, data] = await Promise.all([params, searchParams, getDataset()]);
  if (!['equipes', 'joueurs'].includes(kind)) notFound();
  const selectedA = data.players.some((p) => p.id === q.a) ? q.a : data.players[0]?.id;
  const selectedB = data.players.some((p) => p.id === q.b)
    ? q.b
    : data.players.find((p) => p.id !== selectedA)?.id;
  const display = catalogDataset(data);
  display.players =
    kind === 'joueurs' ? data.players.filter((p) => [selectedA, selectedB].includes(p.id)) : [];
  if (kind === 'joueurs') {
    const ids = new Set(display.players.map((p) => p.teamId));
    display.teams = data.teams.filter((t) => ids.has(t.id));
    display.competitions = [];
  }
  return (
    <Comparator
      key={kind === 'joueurs' ? `${selectedA}:${selectedB}` : kind}
      data={display}
      playerChoices={
        kind === 'joueurs'
          ? data.players.map((p) => ({
              id: p.id,
              name: `${p.name} — ${data.teams.find((t) => t.id === p.teamId)?.short ?? ''}`,
            }))
          : undefined
      }
      summaries={kind === 'equipes' ? comparisonView(data) : {}}
      kind={kind === 'equipes' ? 'teams' : 'players'}
      initialA={kind === 'joueurs' ? selectedA : q.a}
      initialB={kind === 'joueurs' ? selectedB : q.b}
    />
  );
}
