import { db } from '@/database/client';
import { eloHistory } from '@/prediction-engine/elo';
import type { Match } from '@/types/football';
import { readLocalHistory } from './local-store';
export async function rebuildElo(matches?: Match[]) {
  const computed = eloHistory(matches ?? (await readLocalHistory()), new Date().toISOString());
  // Only changed ratings are written; chronological replay also repairs historical corrections.
  const existing = await db.eloHistory.findMany();
  const byKey = new Map(existing.map((e) => [`${e.teamId}-${e.matchId}`, e]));
  const keep = new Set<string>();
  for (const e of computed.history) {
    const id = `${e.teamId}-${e.matchId}`;
    keep.add(id);
    const old = byKey.get(id);
    if (old && old.before === e.before && old.after === e.after && old.at.toISOString() === e.at)
      continue;
    await db.eloHistory.upsert({
      where: { teamId_matchId: { teamId: e.teamId, matchId: e.matchId } },
      create: { ...e, id, at: new Date(e.at) },
      update: { before: e.before, after: e.after, at: new Date(e.at) },
    });
  }
  const removed = existing.filter((e) => !keep.has(`${e.teamId}-${e.matchId}`)).map((e) => e.id);
  if (removed.length) await db.eloHistory.deleteMany({ where: { id: { in: removed } } });
  return { ratings: computed.ratings.size, observations: computed.history.length };
}
