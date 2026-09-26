import 'server-only';
import { db } from '@/database/client';
import type { PlayerStats } from '@/types/football';
export async function playerHistory(playerId: string) {
  if (!process.env.DATABASE_URL) return [];
  try {
    const rows = await db.playerStatistics.findMany({
      where: { playerId },
      include: { season: { include: { competition: true } } },
      orderBy: { asOf: 'desc' },
      take: 300,
    });
    const seen = new Set<string>();
    return rows
      .filter((r) => {
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
