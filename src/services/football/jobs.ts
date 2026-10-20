import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { db } from '@/database/client';
import { runtimeDatabaseUrl, selectedDatabaseUrl } from '@/database/connection';
import { cache } from '@/services/cache';
import { log, databaseErrorFields } from '@/lib/logger';
import { footballLease, assertJobActive } from './lease-context';
/** All writers share the same lease, so OpenFootball cannot overwrite an enrichment snapshot. */
export async function footballJob<T>(provider: string, work: () => Promise<T>) {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_NOT_CONFIGURED');
  const token = randomUUID(),
    expiresAt = new Date(Date.now() + 2 * 60_000),
    obsoleteLease = new Date(Date.now() + 5 * 60_000);
  const acquired = await db.$queryRaw<
    { key: string }[]
  >`INSERT INTO "SyncLock" ("key","token","expiresAt") VALUES ('football',${token},${expiresAt}::timestamptz AT TIME ZONE 'UTC') ON CONFLICT ("key") DO UPDATE SET "token"=${token},"expiresAt"=${expiresAt}::timestamptz AT TIME ZONE 'UTC' WHERE "SyncLock"."expiresAt"<(NOW() AT TIME ZONE 'UTC') OR "SyncLock"."expiresAt">${obsoleteLease}::timestamptz AT TIME ZONE 'UTC' RETURNING "key"`;
  if (!acquired.length) throw new Error('SYNC_ALREADY_RUNNING');
  const lease = { token, lost: false };
  let heartbeatDb: PrismaClient | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let renewing: Promise<void> | undefined;
  let run: { id: string } | undefined;
  try {
    // Reserve a separate connection on the VPS too. Publication transactions
    // and concurrent cron requests must not queue renewal behind the main pool.
    // Allocate only after acquisition so rejected jobs cannot leak clients.
    heartbeatDb = new PrismaClient({
      datasourceUrl: runtimeDatabaseUrl(selectedDatabaseUrl(), true, 1),
      log: [],
    });
    await heartbeatDb.$connect();
    const renewalDb = heartbeatDb;
    const renew = () => {
      if (renewing) return renewing;
      renewing = renewalDb.syncLock
        .updateMany({
          where: { key: 'football', token },
          data: { expiresAt: new Date(Date.now() + 2 * 60_000) },
        })
        .then((result) => {
          if (result.count !== 1) {
            lease.lost = true;
            log('FOOTBALL_LEASE_OWNERSHIP_LOST', { count: result.count });
          }
        })
        .catch((error) => {
          lease.lost = true;
          log('FOOTBALL_LEASE_RENEWAL_FAILED', databaseErrorFields(error));
        })
        .finally(() => {
          renewing = undefined;
        });
      return renewing;
    };
    // Verify the reserved connection and ownership before opening any work.
    await renew();
    if (lease.lost) throw new Error('SYNC_LEASE_LOST');
    heartbeat = setInterval(() => {
      void renew();
    }, 30_000);
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
    if (heartbeat) clearInterval(heartbeat);
    await renewing;
    try {
      await db.syncLock.deleteMany({ where: { key: 'football', token } });
    } finally {
      await heartbeatDb?.$disconnect();
    }
  }
}
