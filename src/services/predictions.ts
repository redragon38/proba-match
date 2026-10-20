import 'server-only';
import { log } from '@/lib/logger';
import type { Prisma } from '@prisma/client';
import { db } from '@/database/client';
import { predictionEngine, MODEL_VERSION, MODEL_PARAMETERS } from '@/prediction-engine';
import type { Dataset, EvaluatedPrediction, Match, Prediction } from '@/types/football';
import { regulationResult } from '@/prediction-engine/result-period';
import { metrics } from '@/prediction-engine/evaluation';
import { recordTiming } from '@/services/telemetry';
import { assertJobActive, fencePublication } from '@/services/football/lease-context';
import { latestPublicPredictionsSql, publicPredictionHistorySql } from './prediction-read-sql';
import type { PreparedForecast } from '@/prediction-engine';
/** Full input packages stay in the immutable DB payload, not in client page props. */
export function publicPrediction(p: Prediction): Prediction {
  const result = { ...p };
  delete result.inputArchive;
  return result;
}

export function computeDisplayPrediction(
  match: Match,
  data: Dataset,
  now = new Date(),
): Prediction | undefined {
  if (match.status !== 'scheduled') return undefined;
  if (match.kickoffKnown === false) return undefined;
  const kickoff = new Date(match.kickoff).getTime();
  if (!Number.isFinite(kickoff) || kickoff <= now.getTime()) return undefined;
  const cutoff = new Date(Math.min(now.getTime(), kickoff - 1000)).toISOString();
  // Current forecasts may use the conservative reconstructed availability rule
  // when an imported historical result predates our reception journal. Finished
  // matches still require an immutable archived forecast and are never backfilled.
  const prediction =
    predictionEngine.predict(match, data.matches, cutoff, false) ??
    predictionEngine.predictReconstructed?.(match, data.matches, cutoff, false);
  return prediction ? publicPrediction(prediction) : undefined;
}

function computedDisplayPredictions(
  data: Dataset,
  now = new Date(),
  targetIds?: ReadonlySet<string>,
) {
  return Object.fromEntries(
    data.matches.flatMap((match) => {
      if (targetIds && !targetIds.has(match.id)) return [];
      const prediction = computeDisplayPrediction(match, data, now);
      return prediction ? [[match.id, prediction]] : [];
    }),
  );
}

export async function getPredictions(
  data: Dataset,
  targetIds?: ReadonlySet<string>,
  computeMissing = true,
): Promise<Record<string, Prediction>> {
  if (data.source === 'demo')
    return computedDisplayPredictions(
      { ...data, matches: data.matches.filter((m) => !m.id.startsWith('history')) },
      new Date(),
      targetIds,
    );
  if (!process.env.DATABASE_URL) return computedDisplayPredictions(data, new Date(), targetIds);
  try {
    const ids = targetIds ?? new Set(data.matches.map((m) => m.id));
    if (!ids.size) return {};
    // Only the latest public forecast crosses the connection. Full input archives
    // remain stored unchanged for reproducibility and objective evaluation.
    const rows = await db.$queryRaw<{ matchId: string; payload: unknown }[]>(
      latestPublicPredictionsSql([...ids]),
    );
    const predictions = Object.fromEntries(
      rows
        .filter((r) => ids.has(r.matchId))
        .map((r) => [r.matchId, publicPrediction(r.payload as unknown as Prediction)]),
    );
    if (computeMissing) {
      const missingIds = new Set([...ids].filter((matchId) => !predictions[matchId]));
      for (const [matchId, prediction] of Object.entries(
        computedDisplayPredictions(data, new Date(), missingIds),
      )) {
        predictions[matchId] = prediction;
      }
    }
    return predictions;
  } catch {
    return computeMissing ? computedDisplayPredictions(data, new Date(), targetIds) : {};
  }
}
export async function getPredictionHistory(
  matchId: string,
  source: Dataset['source'],
): Promise<Prediction[]> {
  if (source === 'demo' || !process.env.DATABASE_URL) return [];
  try {
    return (await db.$queryRaw<{ payload: unknown }[]>(publicPredictionHistorySql(matchId)))
      .reverse()
      .map((r) => publicPrediction(r.payload as unknown as Prediction));
  } catch {
    return [];
  }
}
async function updatePublicationMarker(db: Prisma.TransactionClient) {
  const marker = await db.cacheEntry.findUnique({
    where: { key: 'football:dataset' },
    select: { updatedAt: true },
  });
  if (marker)
    await db.cacheEntry.update({
      where: { key: 'football:dataset' },
      data: { updatedAt: new Date(Math.max(Date.now(), marker.updatedAt.getTime() + 1)) },
      select: { key: true },
    });
}

async function persistEvaluationTransaction(db: Prisma.TransactionClient, data: Dataset) {
  assertJobActive();
  if (data.source === 'demo') return;
  let contentChanged = false;
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
  if (contentChanged) await updatePublicationMarker(db);
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
  const coverage = { eligible: 0, existing: 0, created: 0, unavailable: 0 };
  let forecast: PreparedForecast | undefined;
  let reconstructedForecast: PreparedForecast | undefined;
  await db.predictionVersion.upsert({
    where: { id: MODEL_VERSION },
    create: {
      id: MODEL_VERSION,
      description:
        'Elo–Poisson 1.4 : révisions point-in-time, score réglementaire, terrain neutre confirmé, quantité effective et archive reproductible ; coefficients sportifs conservés',
      parameters: MODEL_PARAMETERS,
    },
    update: {},
    select: { id: true },
  });
  // Publish the nearest fixtures first. Each successful commit is visible immediately,
  // even if a later fixture fails. Expensive CPU work holds no database transaction.
  const upcoming = data.matches
    .filter(
      (match) =>
        match.status === 'scheduled' &&
        match.kickoffKnown !== false &&
        new Date(match.kickoff) > now &&
        new Date(match.kickoff).getTime() < now.getTime() + 21 * 86400_000,
    )
    .sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff) || a.id.localeCompare(b.id));
  coverage.eligible = upcoming.length;
  for (const match of upcoming) {
    assertJobActive();
    const initial = await db.prediction.findUnique({
      select: { id: true },
      where: {
        matchId_versionId_kind: { matchId: match.id, versionId: MODEL_VERSION, kind: 'initial' },
      },
    });
    // Existing snapshots are immutable. Avoid recalculating a published kind.
    if (initial) {
      coverage.existing++;
      if (match.lineups.length !== 2 || !match.lineups.every((lineup) => lineup.confirmed))
        continue;
      const lineup = await db.prediction.findUnique({
        select: { id: true },
        where: {
          matchId_versionId_kind: { matchId: match.id, versionId: MODEL_VERSION, kind: 'lineup' },
        },
      });
      if (lineup) continue;
    }
    const started = globalThis.performance.now();
    forecast ??=
      predictionEngine.prepare?.(data.matches, now.toISOString()) ??
      ((target) => predictionEngine.predict(target, data.matches, now.toISOString()));
    let p = forecast(match);
    if (!p) {
      reconstructedForecast ??=
        predictionEngine.prepareReconstructed?.(data.matches, now.toISOString()) ??
        ((target) =>
          predictionEngine.predictReconstructed(target, data.matches, now.toISOString()));
      p = reconstructedForecast(match);
    }
    recordTiming('prediction:compute', globalThis.performance.now() - started);
    // Let lease-renewal timers run between CPU work and publication.
    await new Promise<void>((resolve) => setImmediate(resolve));
    assertJobActive();
    if (!p) {
      if (!initial) coverage.unavailable++;
      continue;
    }
    const kind = initial && p.lineupConfirmed ? 'lineup' : 'initial';
    if (initial && kind === 'initial') continue;
    // Serialize the immutable archive once, outside the short publication transaction.
    const payload = JSON.stringify(p);
    const inserted = await db.$transaction(
      async (tx) => {
        assertJobActive();
        const count = await tx.$executeRaw`
        INSERT INTO "Prediction" ("id", "matchId", "versionId", "kind", "createdAt", "cutoff",
          "home", "draw", "away", "confidence", "inputHash", "payload")
        VALUES (${p.id}, ${match.id}, ${MODEL_VERSION}, ${kind},
          ${now}, ${new Date(p.cutoff)}, ${p.home}, ${p.draw}, ${p.away},
          ${p.confidence}, ${p.inputHash}, ${payload}::jsonb)
        ON CONFLICT ("matchId", "versionId", "kind") DO NOTHING
      `;
        if (count) await updatePublicationMarker(tx);
        await fencePublication(tx);
        return count;
      },
      { maxWait: 10_000, timeout: 30_000 },
    );
    if (inserted) {
      if (!initial) coverage.created++;
      log('PREDICTION_PUBLISHED', { code: match.id, count: coverage.created });
    }
  }
  await db.$transaction(
    async (tx) => {
      await persistEvaluationTransaction(tx, data);
      await fencePublication(tx);
    },
    { maxWait: 10_000, timeout: 30_000 },
  );
  return coverage;
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
