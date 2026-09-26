import { syncOpenFootball, openScopes } from '../src/services/football/openfootball-sync';
import { syncSecondary } from '../src/services/football/secondary';
import { db } from '../src/database/client';
import { nextOpenDeadline, runWorkerLoop } from '../src/services/football/worker-loop';
import { log } from '../src/lib/logger';
let stopping = false;
let wake: (() => void) | undefined;
const stop = () => {
  stopping = true;
  wake?.();
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
try {
  await runWorkerLoop({
    now: Date.now,
    stopped: () => stopping,
    wait: (ms) =>
      new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          wake = undefined;
          resolve();
        }, ms);
        wake = () => {
          clearTimeout(timer);
          wake = undefined;
          resolve();
        };
      }),
    nextOpen: async () => {
      const ids = openScopes().map((scope) => `openfootball:${scope.league}:${scope.season}`);
      const sources = await db.dataSource.findMany({
        where: { id: { in: ids } },
        select: { lastSyncedAt: true },
      });
      return nextOpenDeadline(sources, ids.length);
    },
    open: async () => {
      const result = await syncOpenFootball();
      console.log(result);
      return result;
    },
    secondary: async () => {
      const result = await syncSecondary({ enrich: true });
      console.log(result);
      return result;
    },
    secondaryEnabled: () => !!process.env.FOOTBALL_API_KEY,
    log: (event, count) => log(event, { count }),
    heartbeat: async (heartbeat) => {
      const value = {
        payload: { ...heartbeat, pid: process.pid },
        expiresAt: new Date(Date.now() + 120000),
        staleUntil: new Date(Date.now() + 120000),
      };
      await db.cacheEntry.upsert({
        where: { key: 'football:worker' },
        create: { key: 'football:worker', ...value },
        update: value,
      });
    },
  });
} finally {
  await db.$disconnect();
}
