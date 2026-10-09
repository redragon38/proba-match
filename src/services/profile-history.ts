import 'server-only';
import { db } from '@/database/client';
import { Prisma } from '@prisma/client';
import type { PlayerStats } from '@/types/football';
export async function playerHistory(playerId: string, asOf?: string) {
  if (!process.env.DATABASE_URL) return [];
  try {
    const cutoff = asOf && Number.isFinite(Date.parse(asOf)) ? new Date(asOf) : null;
    // Prisma's distinct deduplicates after fetching. Select the latest observation
    // per season in PostgreSQL so repeated syncs never transfer every old snapshot.
    const rows = await db.$queryRaw<
      {
        season: number;
        competition: string;
        asOf: Date;
        payload: unknown;
      }[]
    >(Prisma.sql`
      SELECT DISTINCT ON (ps."seasonId") s."year" AS season,
        c."name" AS competition, ps."asOf", ps."payload"
      FROM "PlayerStatistics" ps
      JOIN "Season" s ON s."id" = ps."seasonId"
      JOIN "Competition" c ON c."id" = s."competitionId"
      WHERE ps."playerId" = ${playerId}
        AND ps."payload"->'scope'->>'verified' = 'true'
        AND ps."payload"->'scope'->>'season' = s."year"::text
        AND ps."payload"->'scope'->>'competitionId' = s."competitionId"
        ${cutoff ? Prisma.sql`AND ps."asOf" <= ${cutoff}` : Prisma.empty}
      ORDER BY ps."seasonId", ps."asOf" DESC, ps."id" DESC
    `);
    return rows
      .sort((a, b) => b.asOf.getTime() - a.asOf.getTime())
      .map((r) => ({
        season: r.season,
        competition: r.competition,
        asOf: r.asOf.toISOString(),
        stats: r.payload as unknown as PlayerStats,
      }));
  } catch {
    return [];
  }
}
