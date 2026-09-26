import 'server-only';
import { cache as requestCache } from 'react';
import { cache, MemoryCache } from '@/services/cache';
import { createDemoDataset } from './providers/mock';
import { readLocalDataset, emptyDataset } from './local-store';
import { log } from '@/lib/logger';
import type { Dataset } from '@/types/football';
import { db } from '@/database/client';
import { withSourceFreshness } from './freshness';
const datasets = new MemoryCache(2);
export const getDataset = requestCache(async function getDataset(): Promise<Dataset> {
  if (!process.env.DATABASE_URL) {
    if (process.env.NODE_ENV !== 'production' && process.env.MATCHSCORE_DEMO === 'true')
      return cache.get('demo', async () => createDemoDataset(), 30000, 0);
    return emptyDataset(
      'PostgreSQL non configuré. Les données OpenFootball seront disponibles après le premier import.',
    );
  }
  try {
    const marker = await db.cacheEntry.findUnique({
      where: { key: 'football:dataset' },
      select: { updatedAt: true },
    });
    return await datasets
      .get(
        `dataset:${marker?.updatedAt.toISOString() ?? 'empty'}`,
        async () => {
          try {
            return await readLocalDataset();
          } catch {
            log('dataset_read_failed', { code: 'DATABASE_UNAVAILABLE' });
            throw new Error('DATABASE_UNAVAILABLE');
          }
        },
        15000,
        7 * 86400_000,
      )
      .then((data) => {
        lastDataset = data;
        return withSourceFreshness(data);
      });
  } catch {
    return lastDataset
      ? withSourceFreshness({
          ...lastDataset,
          degraded: true,
          warning: [
            lastDataset.warning,
            'Dernières données sauvegardées. La base est temporairement indisponible.',
          ]
            .filter(Boolean)
            .join(' '),
        })
      : emptyDataset('La base est temporairement indisponible. Réessayez plus tard.');
  }
});
let lastDataset: Dataset | undefined;
