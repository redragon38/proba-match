import { db } from '@/database/client';
import { cronHandler } from '@/services/football/cron';
import { observeResult, validResult } from '@/prediction-engine/availability';
import type { Dataset, Match } from '@/types/football';

export const maxDuration = 300;

const json = (value: unknown) => JSON.parse(JSON.stringify(value));

export const GET = cronHandler(async () => {
  const observedAt = new Date().toISOString();
  const [entry, rows] = await Promise.all([
    db.cacheEntry.findUnique({ where: { key: 'football:dataset' } }),
    db.match.findMany({
      where: { status: 'finished' },
      select: { id: true, payload: true },
    }),
  ]);
  if (!entry) throw new Error('DATASET_NOT_AVAILABLE');

  const repaired = rows.flatMap((row) => {
    const match = row.payload as unknown as Match;
    if (!validResult(match) || match.resultObservedAt) return [];
    return [{ id: row.id, match: observeResult(match, match, observedAt) }];
  });
  if (!repaired.length) return { status: 'success', observed: 0 };

  const replacements = new Map(repaired.map((row) => [row.id, row.match]));
  const data = structuredClone(entry.payload as unknown as Dataset);
  data.matches = data.matches.map((match) => replacements.get(match.id) ?? match);
  data.updatedAt = observedAt;
  data.verifiedAt = { ...data.verifiedAt, results: observedAt };

  await db.$transaction(
    async (tx) => {
      for (let offset = 0; offset < repaired.length; offset += 500) {
        const batch = repaired.slice(offset, offset + 500).map((row) => ({
          id: row.id,
          payload: json(row.match),
        }));
        await tx.$executeRaw`
          UPDATE "Match" AS match
          SET "payload" = incoming."payload", "updatedAt" = NOW() AT TIME ZONE 'UTC'
          FROM jsonb_to_recordset(${JSON.stringify(batch)}::jsonb)
            AS incoming("id" text, "payload" jsonb)
          WHERE match."id" = incoming."id"
        `;
      }
      await tx.resultObservation.createMany({
        data: repaired.flatMap(({ id, match }) =>
          (match.resultRevisions ?? []).map((revision, index) => ({
            id: `${id}:${revision.observedAt}:${index}`,
            matchId: id,
            receivedAt: new Date(revision.observedAt),
            source: revision.source,
            payload: json(revision),
          })),
        ),
        skipDuplicates: true,
      });
      await tx.cacheEntry.update({
        where: { key: 'football:dataset' },
        data: { payload: json(data) },
      });
    },
    { maxWait: 10_000, timeout: 300_000 },
  );

  return { status: 'success', observed: repaired.length, observedAt };
});
