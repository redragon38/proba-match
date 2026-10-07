import 'server-only';
import { cache as requestCache } from 'react';
import { cache, datasetCache } from '@/services/cache';
import { createDemoDataset } from './providers/mock';
import { readLocalDataset, emptyDataset } from './local-store';
import { log } from '@/lib/logger';
import type { Dataset } from '@/types/football';
import { db } from '@/database/client';
import { timed } from '@/services/telemetry';
import { withSnapshotExpiry, withSourceFreshness } from './freshness';
const datasets = datasetCache;
export const getDataset = requestCache(async function getDataset(): Promise<Dataset> {
  if (!process.env.DATABASE_URL) {
    if (process.env.NODE_ENV !== 'production' && process.env.MATCHSCORE_DEMO === 'true')
      return cache.get('demo', async () => createDemoDataset(), 30000, 0);
    return emptyDataset(
      'Les données football ne sont pas disponibles pour le moment. Les guides et explications restent accessibles.',
    );
  }
  try {
    const marker = await timed('db:dataset_revision', () =>
      db.cacheEntry.findUnique({
        where: { key: 'football:dataset' },
        select: { updatedAt: true, expiresAt: true },
      }),
    );
    return await datasets
      .get(
        `dataset:${marker?.updatedAt.toISOString() ?? 'empty'}`,
        async () => {
          try {
            return await timed('db:dataset_load', readLocalDataset);
          } catch {
            log('dataset_read_failed', { code: 'DATABASE_UNAVAILABLE' });
            throw new Error('DATABASE_UNAVAILABLE');
          }
        },
        10 * 60000,
        0,
      )
      .then((data) => {
        lastDataset = data;
        return withSourceFreshness(
          marker ? withSnapshotExpiry(data, marker.expiresAt.getTime()) : data,
        );
      });
  } catch {
    const unavailableWarning =
      'Les données football sont temporairement indisponibles. Les guides et explications restent accessibles.';
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
      : emptyDataset(unavailableWarning);
  }
});
let lastDataset: Dataset | undefined;
