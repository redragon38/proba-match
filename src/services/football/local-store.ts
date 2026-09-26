import { db } from '@/database/client';
import type { Dataset, Match } from '@/types/football';
import { teamLogo } from '@/lib/team-logo';
export function emptyDataset(warning?: string): Dataset {
  return {
    source: 'openfootball',
    updatedAt: '',
    competitions: [],
    teams: [],
    matches: [],
    players: [],
    injuries: [],
    standings: {},
    warning,
  };
}
export async function readLocalDataset(): Promise<Dataset> {
  const entry = await db.cacheEntry.findUnique({ where: { key: 'football:dataset' } });
  if (!entry)
    return emptyDataset(
      'Aucun import disponible. Lancez l’import OpenFootball depuis l’administration.',
    );
  const data = entry.payload as unknown as Dataset;
  if (data.source === 'demo') throw new Error('DEMO_NOT_ALLOWED_IN_REAL_STORE');
  return {
    ...data,
    teams: data.teams.map((team) => ({ ...team, logo: teamLogo(team) })),
    revision: entry.updatedAt.toISOString(),
    degraded: !!data.degraded || entry.expiresAt.getTime() < Date.now(),
    warning:
      entry.expiresAt.getTime() < Date.now()
        ? 'Dernières données sauvegardées. La synchronisation est en retard ; les scores peuvent être différés.'
        : data.warning,
  };
}
export async function readLocalHistory(): Promise<Match[]> {
  const rows = await db.match.findMany({
    orderBy: [{ kickoff: 'asc' }, { id: 'asc' }],
    select: { payload: true },
  });
  return rows.map((r) => r.payload as unknown as Match).filter((m) => m.source !== 'demo');
}
