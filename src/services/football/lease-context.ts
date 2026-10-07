import { AsyncLocalStorage } from 'node:async_hooks';
import type { Prisma } from '@prisma/client';
export const footballLease = new AsyncLocalStorage<{ token: string; lost: boolean }>();
export function assertJobActive() {
  if (footballLease.getStore()?.lost) throw new Error('SYNC_LEASE_LOST');
}
/** Row lock serializes the publication with acquisition/renewal of the same lease. */
export async function fencePublication(tx: Prisma.TransactionClient) {
  const lease = footballLease.getStore();
  if (!lease) return; // Explicit local seed/maintenance operations have no job lease.
  assertJobActive();
  const rows = await tx.$queryRaw<
    { token: string; active: boolean }[]
  >`SELECT "token", "expiresAt" > clock_timestamp() AT TIME ZONE 'UTC' AS active FROM "SyncLock" WHERE "key"='football' FOR UPDATE`;
  if (rows.length !== 1 || rows[0].token !== lease.token || !rows[0].active)
    throw new Error('SYNC_LEASE_LOST');
}
