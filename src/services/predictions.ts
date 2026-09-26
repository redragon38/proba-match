import 'server-only';
import { db } from '@/database/client';
import { predictionEngine, MODEL_VERSION, MODEL_PARAMETERS } from '@/prediction-engine';
import type { Dataset, EvaluatedPrediction, Prediction } from '@/types/football';
import { metrics } from '@/prediction-engine/evaluation';
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
          return p ? [[m.id, p]] : [];
        }),
    );
  if (!process.env.DATABASE_URL) return {};
  try {
    const rows = await db.prediction.findMany({
      where: { matchId: { in: data.matches.map((m) => m.id) } },
      orderBy: { createdAt: 'asc' },
      select: { matchId: true, payload: true },
    });
    return Object.fromEntries(rows.map((r) => [r.matchId, r.payload as unknown as Prediction]));
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
      await db.prediction.findMany({ where: { matchId }, orderBy: { createdAt: 'asc' }, take: 100 })
    ).map((r) => r.payload as unknown as Prediction);
  } catch {
    return [];
  }
}
export async function persistPredictions(data: Dataset, now = new Date()) {
  if (data.source === 'demo') return;
  await db.predictionVersion.upsert({
    where: { id: MODEL_VERSION },
    create: {
      id: MODEL_VERSION,
      description: 'Elo et Poisson indépendants avec décroissance temporelle',
      parameters: MODEL_PARAMETERS,
    },
    update: {},
  });
  const finishedIds = data.matches
    .filter((m) => m.status === 'finished' && m.homeScore !== null && m.awayScore !== null)
    .map((m) => m.id);
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
    if (
      match.status === 'scheduled' &&
      match.kickoffKnown !== false &&
      new Date(match.kickoff) > now &&
      new Date(match.kickoff).getTime() < now.getTime() + 7 * 86400_000
    ) {
      const p = predictionEngine.predict(match, data.matches, now.toISOString());
      if (!p) continue;
      const initial = await db.prediction.findUnique({
        where: {
          matchId_versionId_kind: { matchId: match.id, versionId: MODEL_VERSION, kind: 'initial' },
        },
      });
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
    }
    if (match.status === 'finished' && match.homeScore !== null && match.awayScore !== null) {
      const predictions = pendingByMatch.get(match.id) ?? [];
      for (const row of predictions) {
        const p = row.payload as unknown as Prediction;
        const score = metrics([
          {
            prediction: p,
            homeScore: match.homeScore,
            awayScore: match.awayScore,
            competitionId: match.competitionId,
            kickoff: match.kickoff,
          },
        ])!;
        await db.predictionResult.create({
          data: {
            id: row.id,
            predictionId: row.id,
            homeScore: match.homeScore,
            awayScore: match.awayScore,
            brier: score.brier,
            logLoss: score.logLoss,
          },
        });
      }
    }
  }
  const evaluations = await getEvaluations();
  const performance = metrics(evaluations.filter((r) => r.prediction.version === MODEL_VERSION));
  if (performance)
    await db.modelPerformance.upsert({
      where: { versionId_period: { versionId: MODEL_VERSION, period: 'latest-10000' } },
      create: {
        id: `${MODEL_VERSION}-latest-10000`,
        versionId: MODEL_VERSION,
        period: 'latest-10000',
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
export async function getEvaluations(): Promise<EvaluatedPrediction[]> {
  if (!process.env.DATABASE_URL) return [];
  try {
    const rows = await db.prediction.findMany({
      where: { kind: 'initial', result: { isNot: null } },
      include: { result: true, match: { include: { season: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10000,
    });
    return rows.map((r) => ({
      prediction: r.payload as unknown as Prediction,
      homeScore: r.result!.homeScore,
      awayScore: r.result!.awayScore,
      competitionId: r.match.season.competitionId,
      kickoff: r.match.kickoff.toISOString(),
    }));
  } catch {
    return [];
  }
}
