import { syncOpenFootball, openScopes } from '../src/services/football/openfootball-sync';
import { syncSecondary } from '../src/services/football/secondary';
import { db } from '../src/database/client';
import { nextOpenDeadline, runWorkerLoop } from '../src/services/football/worker-loop';
import { log } from '../src/lib/logger';
import { syncSportsDbPlayers } from '../src/services/football/sportsdb-sync';
import { syncExpandedFootball, syncExpandedPlayers } from '../src/services/football/espn-sync';
import { expandedScopes } from '../src/services/football/providers/espn';
let stopping = false;
let nextPlayers = 0;
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
      const ids = [
        ...openScopes().map((scope) => `openfootball:${scope.league}:${scope.season}`),
        ...expandedScopes().map((scope) => `espn:${scope.league}:${scope.season}`),
      ];
      const sources = await db.dataSource.findMany({
        where: { id: { in: ids } },
        select: { lastSyncedAt: true },
      });
      return nextOpenDeadline(sources, ids.length);
    },
    open: async () => {
      const result = await syncOpenFootball();
      const expanded = await syncExpandedFootball();
      console.log(result, expanded);
      return {
        status:
          result.status === 'success' && expanded.status === 'success' ? 'success' : 'partial',
      };
    },
    secondary: async () => {
      const secondary = process.env.FOOTBALL_API_KEY ? await syncSecondary({ enrich: true }) : null;
      if (secondary) console.log(secondary);
      if (Date.now() < nextPlayers) return secondary ?? { status: 'waiting' };
      const expandedPlayers = await syncExpandedPlayers(15);
      const players = await syncSportsDbPlayers(15);
      console.log(expandedPlayers);
      nextPlayers =
        Date.now() +
        (expandedPlayers.remaining > 0
          ? 15 * 60_000
          : players.status === 'awaiting_openfootball'
            ? 3600_000
            : 6 * 3600_000);
      console.log(players);
      return secondary ?? players;
    },
    secondaryEnabled: () => !!process.env.FOOTBALL_API_KEY || Date.now() >= nextPlayers,
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
