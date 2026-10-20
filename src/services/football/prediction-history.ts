import { db } from '@/database/client';
import { currentSeason, openScopes, syncOpenFootball } from './openfootball-sync';

/** Early-season forecasts need the previous season, not just five raw results.
 * Keep source observation timestamps real; never backdate imported results.
 * Import once per configured league and retry failed sources on the next run.
 */
export async function ensurePredictionHistory() {
  const scopes = openScopes().map(({ league }) => ({ league, season: currentSeason() - 1 }));
  const key = ({ league, season }: (typeof scopes)[number]) => `openfootball:${league}:${season}`;
  const sources = await db.dataSource.findMany({
    where: { id: { in: scopes.map(key) }, lastSyncedAt: { not: null } },
    select: { id: true },
  });
  const imported = new Set(sources.map((source) => source.id));
  const missing = scopes.filter((scope) => !imported.has(key(scope)));
  if (!missing.length) return { status: 'ready', requested: 0 };
  // Publish all eligible forecasts once, after the history import has committed.
  const result = await syncOpenFootball({ scopes: missing, predictions: false });
  return { status: result.status, requested: missing.length, failures: result.failures };
}
