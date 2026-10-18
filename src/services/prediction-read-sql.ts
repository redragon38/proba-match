import { Prisma } from '@prisma/client';

/** Strip immutable training archives in PostgreSQL, before any network transfer. */
export function latestPublicPredictionsSql(ids: string[]) {
  return Prisma.sql`
    SELECT DISTINCT ON ("matchId") "matchId", "payload" - 'inputArchive' AS "payload"
    FROM "Prediction"
    WHERE "matchId" IN (SELECT jsonb_array_elements_text(${JSON.stringify(ids)}::jsonb))
    ORDER BY "matchId", "createdAt" DESC, "id" DESC
  `;
}

/** Read a public history without transferring the immutable training archives. */
export function publicPredictionHistorySql(matchId: string) {
  return Prisma.sql`
    SELECT "payload" - 'inputArchive' AS "payload"
    FROM "Prediction"
    WHERE "matchId" = ${matchId}
    ORDER BY "createdAt" DESC, "id" DESC
    LIMIT 100
  `;
}
