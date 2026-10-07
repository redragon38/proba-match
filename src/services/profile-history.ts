import 'server-only';
import { db } from '@/database/client';
import type { PlayerStats } from '@/types/football';
export async function playerHistory(playerId: string, asOf?: string) {
  if (!process.env.DATABASE_URL) return [];
  try {
    const rows = await db.playerStatistics.findMany({
      where: {
        playerId,
        payload: { path: ['scope', 'verified'], equals: true },
        ...(asOf && Number.isFinite(Date.parse(asOf)) ? { asOf: { lte: new Date(asOf) } } : {}),
      },
      include: { season: { include: { competition: true } } },
      orderBy: [{ asOf: 'desc' }, { id: 'desc' }],
      distinct: ['seasonId'],
    });
    const seen = new Set<string>();
    return rows
      .filter((r) => {
        const payload = r.payload as unknown as {
          scope?: { verified?: boolean; season?: number; competitionId?: string };
        };
        if (
          payload.scope?.verified !== true ||
          payload.scope.season !== r.season.year ||
          payload.scope.competitionId !== r.season.competitionId
        )
          return false;
        if (seen.has(r.seasonId)) return false;
        seen.add(r.seasonId);
        return true;
      })
      .map((r) => ({
        season: r.season.year,
        competition: r.season.competition.name,
        asOf: r.asOf.toISOString(),
        stats: r.payload as unknown as PlayerStats,
      }));
  } catch {
    return [];
  }
}
