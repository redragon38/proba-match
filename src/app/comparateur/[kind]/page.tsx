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
  searchParams: Promise<{ a?: string }>;
}) {
  const [{ kind }, q, data] = await Promise.all([params, searchParams, getDataset()]);
  if (!['equipes', 'joueurs'].includes(kind)) notFound();
  return (
    <Comparator
      data={catalogDataset(data)}
      summaries={kind === 'equipes' ? comparisonView(data) : {}}
      kind={kind === 'equipes' ? 'teams' : 'players'}
      initialA={q.a}
    />
  );
}
