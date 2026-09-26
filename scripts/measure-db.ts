import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { db } from '../src/database/client';
try {
  const matches = await db.match.findMany({
    where: { status: 'finished' },
    select: { id: true },
    take: 200,
    orderBy: { id: 'asc' },
  });
  const ids = matches.map((m) => m.id);
  const oldRows = [];
  let start = performance.now();
  for (const matchId of ids)
    oldRows.push(...(await db.prediction.findMany({ where: { matchId, result: null } })));
  const beforeMs = performance.now() - start;
  start = performance.now();
  const rows = await db.prediction.findMany({
    where: { matchId: { in: ids }, result: null },
    select: { id: true, matchId: true, payload: true },
  });
  const afterMs = performance.now() - start;
  assert.deepEqual(rows.map((r) => r.id).sort(), oldRows.map((r) => r.id).sort());
  const plans =
    await db.$queryRaw`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT "id", "kickoff" FROM "Match" WHERE "status"='scheduled' AND "kickoff">=CURRENT_DATE AND "kickoff"<CURRENT_DATE + INTERVAL '7 days' ORDER BY "kickoff" LIMIT 100`;
  const cachePlan =
    await db.$queryRaw`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT "updatedAt" FROM "CacheEntry" WHERE "key"='football:dataset'`;
  const indexes =
    await db.$queryRaw`SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND tablename IN ('Match','Prediction','CacheEntry','EntityMapping','Player','Team')`;
  const result = {
    at: new Date().toISOString(),
    readOnly: true,
    scenario:
      'Unscored predictions for 200 finished matches; same rows checked, no model calculation or writes.',
    before: { queries: ids.length, ms: beforeMs },
    after: { queries: 1, ms: afterMs },
    pendingRows: rows.length,
    plans,
    cachePlan,
    indexes,
  };
  await writeFile('artifacts/database-performance.json', JSON.stringify(result, null, 2));
  console.log(
    JSON.stringify({ before: result.before, after: result.after, pendingRows: rows.length }),
  );
} finally {
  await db.$disconnect();
}
