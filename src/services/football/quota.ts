import { db } from '@/database/client';
import { log } from '@/lib/logger';
export function secondaryBudget() {
  const parsed = Number(process.env.FOOTBALL_DAILY_BUDGET ?? 90);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 90;
}
export function quotaCeiling(priority: 'live' | 'normal', budget = secondaryBudget()) {
  return priority === 'live' ? budget : Math.max(1, Math.floor(budget * 0.8));
}
export async function reserveQuota(priority: 'live' | 'normal' = 'normal') {
  const day = new Date().toISOString().slice(0, 10),
    limit = quotaCeiling(priority);
  const rows = await db.$queryRaw<
    { count: number }[]
  >`INSERT INTO "ApiQuota" ("day","count") VALUES (${day},1) ON CONFLICT ("day") DO UPDATE SET "count"="ApiQuota"."count"+1 WHERE "ApiQuota"."count"<${limit} RETURNING "count"`;
  if (!rows.length) {
    log('SECONDARY_API_LIMIT_REACHED');
    throw new Error('DAILY_QUOTA_EXHAUSTED');
  }
  if (rows[0].count >= Math.floor(secondaryBudget() * 0.8))
    log('SECONDARY_API_QUOTA_LOW', { count: rows[0].count });
  log('SECONDARY_API_CALL', { count: rows[0].count });
}
