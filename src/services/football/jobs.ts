import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { db } from '@/database/client';
import { runtimeDatabaseUrl, selectedDatabaseUrl } from '@/database/connection';
import { cache } from '@/services/cache';
import { log } from '@/lib/logger';
import { footballLease, assertJobActive } from './lease-context';
/** All writers share the same lease, so OpenFootball cannot overwrite an enrichment snapshot. */
export async function footballJob<T>(provider: string, work: () => Promise<T>) {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_NOT_CONFIGURED');
  // VPS requests and long transactions can occupy the application pool too.
  // Lease renewal must always have its own bounded connection, on every host.
  const heartbeatDb = new PrismaClient({
    datasourceUrl: runtimeDatabaseUrl(selectedDatabaseUrl(), true),
    log: [],
  });
  const token = randomUUID(),
    expiresAt = new Date(Date.now() + 2 * 60_000),
    obsoleteLease = new Date(Date.now() + 5 * 60_000);
  const acquired = await db.$queryRaw<
    { key: string }[]
  >`INSERT INTO "SyncLock" ("key","token","expiresAt") VALUES ('football',${token},${expiresAt}::timestamptz AT TIME ZONE 'UTC') ON CONFLICT ("key") DO UPDATE SET "token"=${token},"expiresAt"=${expiresAt}::timestamptz AT TIME ZONE 'UTC' WHERE "SyncLock"."expiresAt"<(NOW() AT TIME ZONE 'UTC') OR "SyncLock"."expiresAt">${obsoleteLease}::timestamptz AT TIME ZONE 'UTC' RETURNING "key"`.catch(
    async (error: unknown) => {
      await heartbeatDb.$disconnect();
      throw error;
    },
  );
  if (!acquired.length) {
    await heartbeatDb.$disconnect();
    throw new Error('SYNC_ALREADY_RUNNING');
  }
  const lease = { token, lost: false };
  let renewing: Promise<void> | undefined;
  const heartbeat = setInterval(() => {
    if (renewing) return;
    renewing = heartbeatDb.syncLock
      .updateMany({
        where: { key: 'football', token },
        data: { expiresAt: new Date(Date.now() + 2 * 60_000) },
      })
      .then((result) => {
        if (result.count !== 1) lease.lost = true;
      })
      .catch(() => {
        lease.lost = true;
      })
      .finally(() => {
        renewing = undefined;
      });
  }, 30_000);
  const startedAt = Date.now();
  let run: { id: string } | undefined;
  try {
    run = await db.syncRun.create({ data: { provider, status: 'running' } });
    const result = await footballLease.run(lease, async () => {
      const value = await work();
      assertJobActive();
      return value;
    });
    const summary = result as {
      matches?: number;
      players?: number;
      requests?: number;
      status?: string;
      resultsChanged?: number;
    };
    await db.syncRun.update({
      where: { id: run.id },
      data: {
        status: summary.status ?? 'success',
        matches: summary.players ?? summary.matches ?? 0,
        requests: summary.requests ?? 0,
        finishedAt: new Date(),
      },
    });
    cache.clear();
    log('FOOTBALL_JOB_FINISHED', {
      provider,
      status: summary.status ?? 'success',
      matches: summary.matches ?? 0,
      players: summary.players ?? 0,
      resultsChanged: summary.resultsChanged ?? 0,
      durationMs: Date.now() - startedAt,
    });
    return result;
  } catch (error) {
    const knownCode =
      error &&
      typeof error === 'object' &&
      'code' in error &&
      typeof error.code === 'string' &&
      /^[A-Z][A-Z0-9_]{1,63}$/.test(error.code)
        ? error.code
        : error instanceof Error && /^[A-Z][A-Z0-9_]{1,63}$/.test(error.message)
          ? error.message
          : 'UNEXPECTED_ERROR';
    log('FOOTBALL_JOB_FAILED', { code: knownCode, runId: run?.id });
    if (run)
      await db.syncRun
        .update({
          where: { id: run.id },
          data: { status: 'failed', errorCode: knownCode, finishedAt: new Date() },
        })
        .catch(() => undefined);
    throw new Error('SYNC_FAILED');
  } finally {
    clearInterval(heartbeat);
    await renewing;
    try {
      await db.syncLock.deleteMany({ where: { key: 'football', token } });
    } finally {
      await heartbeatDb.$disconnect();
    }
  }
}
