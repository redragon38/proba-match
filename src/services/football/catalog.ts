import { getDataset } from './index';
import { matchDateKey } from '@/lib/match-date';
export async function matchesOnDate(date: string) {
  const data = await getDataset();
  return {
    source: data.source,
    updatedAt: data.updatedAt,
    warning: data.warning,
    date,
    timeZone: 'Europe/Paris',
    matches: data.matches.filter((m) => matchDateKey(m) === date),
  };
}
export async function localEntity(kind: 'match' | 'team' | 'competition', id: string) {
  const data = await getDataset();
  const rows = kind === 'match' ? data.matches : kind === 'team' ? data.teams : data.competitions;
  return rows.find((row) => row.id === id || row.slug === id);
}
