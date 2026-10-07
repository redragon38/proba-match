import { db } from '@/database/client';
import type { Dataset, Match } from '@/types/football';
import { teamLogo } from '@/lib/team-logo';
import { withSnapshotExpiry } from './freshness';
import { reportedStatistics } from './reported-statistics';
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
      'Les données football ne sont pas encore disponibles. Les guides et explications restent accessibles.',
    );
  const data = entry.payload as unknown as Dataset;
  if (data.source === 'demo') throw new Error('DEMO_NOT_ALLOWED_IN_REAL_STORE');
  return withSnapshotExpiry(
    {
      ...data,
      matches: data.matches.map((match) =>
        match.source === 'espn'
          ? { ...match, statistics: reportedStatistics(match.statistics) }
          : match,
      ),
      teams: data.teams.map((team) => ({ ...team, logo: teamLogo(team) })),
      revision: entry.updatedAt.toISOString(),
    },
    entry.expiresAt.getTime(),
  );
}
export async function readLocalHistory(): Promise<Match[]> {
  const rows = await db.match.findMany({
    orderBy: [{ kickoff: 'asc' }, { id: 'asc' }],
    select: { payload: true },
  });
  return rows
    .map((r) => r.payload as unknown as Match)
    .filter((m) => m.source !== 'demo')
    .map((match) =>
      match.source === 'espn'
        ? { ...match, statistics: reportedStatistics(match.statistics) }
        : match,
    );
}
