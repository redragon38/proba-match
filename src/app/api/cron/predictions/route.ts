import { db } from '@/database/client';
import { cronHandler } from '@/services/football/cron';
import { observeResult, validResult } from '@/prediction-engine/availability';
import type { Dataset, Match } from '@/types/football';
import { databaseErrorFields } from '@/lib/logger';
import { readLocalDataset, readLocalHistory } from '@/services/football/local-store';
import { persistPredictions } from '@/services/predictions';
import { ensurePredictionHistory } from '@/services/football/prediction-history';
import { footballJob } from '@/services/football/jobs';
import { fencePublication } from '@/services/football/lease-context';

export const maxDuration = 300;

const json = (value: unknown) => JSON.parse(JSON.stringify(value));

async function repairPredictionInputs() {
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
  const valid = rows.filter((row) => validResult(row.payload as unknown as Match)).length;
  const alreadyObserved = rows.filter((row) =>
    Boolean((row.payload as unknown as Match).resultObservedAt),
  ).length;

  const repairedById = new Map(repaired.map((row) => [row.id, row.match]));
  const replacements = new Map(
    rows.flatMap((row) => {
      const match = repairedById.get(row.id) ?? (row.payload as unknown as Match);
      return validResult(match) && match.resultObservedAt ? [[row.id, match] as const] : [];
    }),
  );
  const data = structuredClone(entry.payload as unknown as Dataset);
  let synchronized = 0;
  data.matches = data.matches.map((match) => {
    const replacement = replacements.get(match.id);
    if (!replacement || replacement.resultObservedAt === match.resultObservedAt) return match;
    synchronized++;
    return replacement;
  });
  if (!repaired.length && !synchronized)
    return {
      status: 'success',
      rows: rows.length,
      valid,
      alreadyObserved,
      observed: 0,
      synchronized: 0,
    };
  data.updatedAt = observedAt;
  data.verifiedAt = { ...data.verifiedAt, results: observedAt };

  try {
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
        if (repaired.length)
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
        await fencePublication(tx);
      },
      { maxWait: 10_000, timeout: 300_000 },
    );
  } catch (error) {
    return { status: 'failed', stage: 'publication', ...databaseErrorFields(error) };
  }

  return {
    status: 'success',
    rows: rows.length,
    valid,
    alreadyObserved,
    observed: repaired.length,
    synchronized,
    observedAt,
  };
}

export const GET = cronHandler(async () => {
  try {
    const history = await ensurePredictionHistory();
    // Share the provider lease: input repair must not overwrite a concurrent
    // import or race another prediction run.
    return await footballJob('predictions', async () => {
      const repair = await repairPredictionInputs();
      if (repair.status !== 'success') return repair;
      const [data, matches] = await Promise.all([readLocalDataset(), readLocalHistory()]);
      const coverage = await persistPredictions({ ...data, matches });
      return { ...repair, history, predictions: 'completed', coverage };
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'SYNC_ALREADY_RUNNING')
      return { status: 'busy', reason: 'SYNC_ALREADY_RUNNING' };
    return { status: 'failed', stage: 'read', ...databaseErrorFields(error) };
  }
});
