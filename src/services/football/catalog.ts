import { getDataset } from './index';
export async function matchesOnDate(date: string) {
  const data = await getDataset();
  return {
    source: data.source,
    updatedAt: data.updatedAt,
    warning: data.warning,
    matches: data.matches.filter(
      (m) => (m.kickoffKnown === false ? m.sourceDate : m.kickoff.slice(0, 10)) === date,
    ),
  };
}
export async function localEntity(kind: 'match' | 'team' | 'competition', id: string) {
  const data = await getDataset();
  const rows = kind === 'match' ? data.matches : kind === 'team' ? data.teams : data.competitions;
  return rows.find((row) => row.id === id || row.slug === id);
}
