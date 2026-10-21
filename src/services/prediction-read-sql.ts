import { Prisma } from '@prisma/client';

/** Evaluation needs only forecast metrics and the current regulation result, never training archives. */
export function evaluatedPredictionsSql() {
  return Prisma.sql`
    SELECT p."payload" - 'inputArchive' - 'factors' AS "prediction",
      m."kickoff", s."competitionId", s."year" AS "season",
      jsonb_build_object('status', m."payload"->'status', 'source', m."payload"->'source',
        'homeScore', m."payload"->'homeScore', 'awayScore', m."payload"->'awayScore',
        'resultPeriod', m."payload"->'resultPeriod', 'scoreBreakdown', m."payload"->'scoreBreakdown') AS "match"
    FROM "Prediction" p
    JOIN "PredictionResult" r ON r."predictionId" = p."id"
    JOIN "Match" m ON m."id" = p."matchId"
    JOIN "Season" s ON s."id" = m."seasonId"
    WHERE p."kind" = 'initial'
    ORDER BY p."createdAt" DESC, p."id" DESC
  `;
}

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
