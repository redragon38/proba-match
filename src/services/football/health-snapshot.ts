import { db } from '@/database/client';

/** Keep the full player/match payload inside PostgreSQL; return only readiness fields. */
export async function healthSnapshot(now: number) {
  const knownDeadline = new Date(now - 6 * 3600000);
  const unknownDeadline = new Date(now - 24 * 3600000);
  const rows = await db.$queryRaw<{ updatedAt: Date; lateResults: boolean }[]>`
    SELECT "updatedAt", COALESCE(
      "payload"->>'source' = 'openfootball' AND EXISTS (
        SELECT 1 FROM jsonb_array_elements("payload"->'matches') AS fixture
        WHERE fixture->>'source' = 'openfootball'
          AND fixture->>'status' = 'scheduled'
          AND (fixture->>'kickoff')::timestamptz <
            CASE WHEN fixture->>'kickoffKnown' = 'false'
              THEN ${unknownDeadline}::timestamptz ELSE ${knownDeadline}::timestamptz END
      ), false) AS "lateResults"
    FROM "CacheEntry" WHERE "key" = 'football:dataset'
  `;
  return rows[0] ?? null;
}
