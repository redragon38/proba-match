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
  const additions: { id: string; teamId: string; matchId: string; before: number; after: number; at: Date }[] = [];
  const corrections: typeof additions = [];
  for (const e of computed.history) {
    const id = `${e.teamId}-${e.matchId}`;
    keep.add(id);
    const old = byKey.get(id);
    if (old && old.before === e.before && old.after === e.after && old.at.toISOString() === e.at)
      continue;
    (old ? corrections : additions).push({ ...e, id, at: new Date(e.at) });
  }
  for (let offset = 0; offset < additions.length; offset += 500)
    await db.eloHistory.createMany({ data: additions.slice(offset, offset + 500), skipDuplicates: true });
  for (let offset = 0; offset < corrections.length; offset += 12)
    await Promise.all(corrections.slice(offset, offset + 12).map((e) =>
      db.eloHistory.update({
        where: { teamId_matchId: { teamId: e.teamId, matchId: e.matchId } },
        data: { before: e.before, after: e.after, at: e.at },
      }),
    ));
  const removed = existing.filter((e) => !keep.has(`${e.teamId}-${e.matchId}`)).map((e) => e.id);
  if (removed.length) await db.eloHistory.deleteMany({ where: { id: { in: removed } } });
  return { ratings: computed.ratings.size, observations: computed.history.length };
}
