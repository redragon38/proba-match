import 'server-only';
import type { Prisma } from '@prisma/client';
import { db } from '@/database/client';
import { predictionEngine, MODEL_VERSION, MODEL_PARAMETERS } from '@/prediction-engine';
import type { Dataset, EvaluatedPrediction, Prediction } from '@/types/football';
import { regulationResult } from '@/prediction-engine/result-period';
import { metrics } from '@/prediction-engine/evaluation';
import { recordTiming } from '@/services/telemetry';
import { assertJobActive, fencePublication } from '@/services/football/lease-context';
/** Full input packages stay in the immutable DB payload, not in client page props. */
function publicPrediction(p: Prediction): Prediction {
  const result = { ...p };
  delete result.inputArchive;
  return result;
}
export async function getPredictions(data: Dataset): Promise<Record<string, Prediction>> {
  if (data.source === 'demo')
    return Object.fromEntries(
      data.matches
        .filter((m) => !m.id.startsWith('history'))
        .flatMap((m) => {
          const p = predictionEngine.predict(
            m,
            data.matches,
            new Date(Math.min(Date.now(), new Date(m.kickoff).getTime() - 1000)).toISOString(),
          );
          return p ? [[m.id, publicPrediction(p)]] : [];
        }),
    );
  if (!process.env.DATABASE_URL) return {};
  try {
    const ids = new Set(data.matches.map((m) => m.id));
    // For a full historical dataset, sending thousands of IDs to PostgreSQL costs
    // more than reading the much smaller prediction table and filtering locally.
    const rows = await db.prediction.findMany({
      where: ids.size <= 1000 ? { matchId: { in: [...ids] } } : undefined,
      orderBy: { createdAt: 'asc' },
      select: { matchId: true, payload: true },
    });
    return Object.fromEntries(
      rows
        .filter((r) => ids.has(r.matchId))
        .map((r) => [r.matchId, publicPrediction(r.payload as unknown as Prediction)]),
    );
  } catch {
    return {};
  }
}
export async function getPredictionHistory(
  matchId: string,
  source: Dataset['source'],
): Promise<Prediction[]> {
  if (source === 'demo' || !process.env.DATABASE_URL) return [];
  try {
    return (
      await db.prediction.findMany({
        where: { matchId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 100,
      })
    )
      .reverse()
      .map((r) => publicPrediction(r.payload as unknown as Prediction));
  } catch {
    return [];
  }
}
async function persistPredictionTransaction(
  db: Prisma.TransactionClient,
  data: Dataset,
  now: Date,
) {
  assertJobActive();
  if (data.source === 'demo') return;
  let contentChanged = false;
  await db.predictionVersion.upsert({
    where: { id: MODEL_VERSION },
    create: {
      id: MODEL_VERSION,
      description:
        'Elo–Poisson 1.4 : révisions point-in-time, score réglementaire, terrain neutre confirmé, quantité effective et archive reproductible ; coefficients sportifs conservés',
      parameters: MODEL_PARAMETERS,
    },
    update: {},
  });
  const finishedIds = data.matches.filter((m) => regulationResult(m) !== null).map((m) => m.id);
  // One indexed read replaces a query for every historical result on every sync.
  const pending = finishedIds.length
    ? await db.prediction.findMany({
        where: { matchId: { in: finishedIds }, result: null },
        select: { id: true, matchId: true, payload: true },
      })
    : [];
  const pendingByMatch = new Map<string, typeof pending>();
  for (const row of pending) {
    const rows = pendingByMatch.get(row.matchId) ?? [];
    rows.push(row);
    pendingByMatch.set(row.matchId, rows);
  }
  for (const match of data.matches) {
    assertJobActive();
    if (
      match.status === 'scheduled' &&
      match.kickoffKnown !== false &&
      new Date(match.kickoff) > now &&
      new Date(match.kickoff).getTime() < now.getTime() + 21 * 86400_000
    ) {
      const initial = await db.prediction.findUnique({
        where: {
          matchId_versionId_kind: { matchId: match.id, versionId: MODEL_VERSION, kind: 'initial' },
        },
      });
      // Existing snapshots are immutable. Avoid recalculating a published kind.
      if (initial) {
        if (match.lineups.length !== 2 || !match.lineups.every((lineup) => lineup.confirmed))
          continue;
        const lineup = await db.prediction.findUnique({
          where: {
            matchId_versionId_kind: { matchId: match.id, versionId: MODEL_VERSION, kind: 'lineup' },
          },
        });
        if (lineup) continue;
      }
      const started = globalThis.performance.now();
      const p = predictionEngine.predict(match, data.matches, now.toISOString());
      recordTiming('prediction:compute', globalThis.performance.now() - started);
      if (!p) continue;
      const kind = initial && p.lineupConfirmed ? 'lineup' : 'initial';
      if (initial && kind === 'initial') continue;
      // Immutable insert. ON CONFLICT performs no mutation. DB trigger also rejects late writes.
      await db.prediction.upsert({
        where: { matchId_versionId_kind: { matchId: match.id, versionId: MODEL_VERSION, kind } },
        update: {},
        create: {
          id: p.id,
          matchId: match.id,
          versionId: MODEL_VERSION,
          kind,
          createdAt: now,
          cutoff: new Date(p.cutoff),
          home: p.home,
          draw: p.draw,
          away: p.away,
          confidence: p.confidence,
          inputHash: p.inputHash,
          payload: JSON.parse(JSON.stringify(p)),
        },
      });
      contentChanged = true;
    }
    const final = regulationResult(match);
    if (final) {
      const predictions = pendingByMatch.get(match.id) ?? [];
      for (const row of predictions) {
        const p = row.payload as unknown as Prediction;
        const score = metrics([
          {
            prediction: p,
            homeScore: final.homeScore!,
            awayScore: final.awayScore!,
            competitionId: match.competitionId,
            kickoff: match.kickoff,
          },
        ])!;
        await db.predictionResult.create({
          data: {
            id: row.id,
            predictionId: row.id,
            homeScore: final.homeScore!,
            awayScore: final.awayScore!,
            brier: score.brier,
            logLoss: score.logLoss,
          },
        });
        contentChanged = true;
      }
    }
  }
  if (contentChanged) {
    // The browser watches this marker every 30 s. Snapshot-only writes must
    // invalidate it too, even when the football dataset payload is unchanged.
    const marker = await db.cacheEntry.findUnique({
      where: { key: 'football:dataset' },
      select: { updatedAt: true },
    });
    if (marker)
      await db.cacheEntry.update({
        where: { key: 'football:dataset' },
        data: { updatedAt: new Date(Math.max(Date.now(), marker.updatedAt.getTime() + 1)) },
      });
  }
  const evaluations = await getEvaluations(db);
  const performance = metrics(evaluations.filter((r) => r.prediction.version === MODEL_VERSION));
  if (performance)
    await db.modelPerformance.upsert({
      where: { versionId_period: { versionId: MODEL_VERSION, period: 'all-published-regulation' } },
      create: {
        id: `${MODEL_VERSION}-all-published-regulation`,
        versionId: MODEL_VERSION,
        period: 'all-published-regulation',
        sample: performance.sample,
        accuracy: performance.accuracy,
        brier: performance.brier,
        logLoss: performance.logLoss,
        calibration: JSON.parse(JSON.stringify(performance.calibration)),
      },
      update: {
        sample: performance.sample,
        accuracy: performance.accuracy,
        brier: performance.brier,
        logLoss: performance.logLoss,
        calibration: JSON.parse(JSON.stringify(performance.calibration)),
      },
    });
}
export async function persistPredictions(data: Dataset, now = new Date()) {
  assertJobActive();
  if (data.source === 'demo') return;
  await db.$transaction(
    async (tx) => {
      await persistPredictionTransaction(tx, data, now);
      // Forecasts, evaluations and publication markers have the same lease fence.
      await fencePublication(tx);
    },
    { maxWait: 10_000, timeout: 30 * 60_000 },
  );
}
export async function getEvaluations(
  client: Pick<Prisma.TransactionClient, 'prediction'> = db,
): Promise<EvaluatedPrediction[]> {
  if (!process.env.DATABASE_URL) return [];
  try {
    const rows = await client.prediction.findMany({
      where: { kind: 'initial', result: { isNot: null } },
      include: { result: true, match: { include: { season: true } } },
      orderBy: { createdAt: 'desc' },
    });
    // Re-evaluate immutable forecasts against the CURRENT confirmed result. A corrected
    // final score must not leave the public performance report stuck on the first score.
    return rows.flatMap((r) => {
      const final = regulationResult(r.match.payload as unknown as Dataset['matches'][number]);
      return final
        ? [
            {
              prediction: publicPrediction(r.payload as unknown as Prediction),
              homeScore: final.homeScore!,
              awayScore: final.awayScore!,
              competitionId: r.match.season.competitionId,
              kickoff: r.match.kickoff.toISOString(),
            },
          ]
        : [];
    });
  } catch {
    return [];
  }
}
