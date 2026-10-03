import { randomUUID } from 'node:crypto';
import { db } from '@/database/client';
import { cache } from '@/services/cache';
import { log } from '@/lib/logger';
/** All writers share the same lease, so OpenFootball cannot overwrite an enrichment snapshot. */
export async function footballJob<T>(provider: string, work: () => Promise<T>) {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_NOT_CONFIGURED');
  const token = randomUUID(),
    expiresAt = new Date(Date.now() + 30 * 60_000);
  const acquired = await db.$queryRaw<
    { key: string }[]
  >`INSERT INTO "SyncLock" ("key","token","expiresAt") VALUES ('football',${token},${expiresAt}::timestamptz AT TIME ZONE 'UTC') ON CONFLICT ("key") DO UPDATE SET "token"=${token},"expiresAt"=${expiresAt}::timestamptz AT TIME ZONE 'UTC' WHERE "SyncLock"."expiresAt"<(NOW() AT TIME ZONE 'UTC') RETURNING "key"`;
  if (!acquired.length) throw new Error('SYNC_ALREADY_RUNNING');
  const heartbeat = setInterval(() => {
    void db.syncLock
      .updateMany({
        where: { key: 'football', token },
        data: { expiresAt: new Date(Date.now() + 30 * 60_000) },
      })
      .catch(() => undefined);
  }, 60_000);
  let run: { id: string } | undefined;
  try {
    run = await db.syncRun.create({ data: { provider, status: 'running' } });
    const result = await work();
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
    clearInterval(heartbeat);
    await db.syncLock.deleteMany({ where: { key: 'football', token } });
  }
}
