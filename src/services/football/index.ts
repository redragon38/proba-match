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
    // A revision changes only when a sync publishes a new snapshot. Sharing this tiny
    // lookup briefly prevents every page view and polling request from opening a new
    // PostgreSQL round trip while keeping live data at most a few seconds behind.
    const marker = await cache.get(
      'football:dataset-revision',
      () =>
        timed('db:dataset_revision', () =>
          db.cacheEntry.findUnique({
            where: { key: 'football:dataset' },
            select: { updatedAt: true, expiresAt: true },
          }),
        ),
      10_000,
      // A refresh triggered by /api/updates must not receive an expired revision.
      // Returning stale here served the old page once and delayed new fixtures
      // until another browser polling cycle, even after publication succeeded.
      0,
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
