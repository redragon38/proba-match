import type { EvaluatedPrediction } from '@/types/football';
export function metrics(rows: EvaluatedPrediction[]) {
  if (!rows.length) return null;
  let correct = 0,
    brier = 0,
    logLoss = 0;
  let homeMae = 0,
    awayMae = 0,
    totalMae = 0,
    goalSample = 0,
    exact = 0,
    scoreSample = 0;
  const calibration = Array.from({ length: 10 }, (_, i) => ({
    bin: i,
    count: 0,
    predicted: 0,
    actual: 0,
  }));
  const calibrationByOutcome = Array.from({ length: 3 }, () => calibration.map((b) => ({ ...b })));
  for (const r of rows) {
    const ps = [r.prediction.home, r.prediction.draw, r.prediction.away],
      outcome = r.homeScore > r.awayScore ? 0 : r.homeScore === r.awayScore ? 1 : 2;
    if (
      !ps.every((p) => Number.isFinite(p) && p >= 0 && p <= 1) ||
      Math.abs(ps.reduce((sum, p) => sum + p, 0) - 1) > 1e-8 ||
      ![r.homeScore, r.awayScore].every((s) => Number.isSafeInteger(s) && s >= 0)
    )
      throw new Error('INVALID_EVALUATION_ROW');
    if (
      [r.prediction.expectedHome, r.prediction.expectedAway].every(
        (g) => Number.isFinite(g) && g >= 0,
      )
    ) {
      homeMae += Math.abs(r.prediction.expectedHome - r.homeScore);
      awayMae += Math.abs(r.prediction.expectedAway - r.awayScore);
      totalMae += Math.abs(
        r.prediction.expectedHome + r.prediction.expectedAway - r.homeScore - r.awayScore,
      );
      goalSample++;
    }
    const topScore = r.prediction.scores?.[0];
    if (topScore) {
      exact += Number(topScore.home === r.homeScore && topScore.away === r.awayScore);
      scoreSample++;
    }
    if (ps.indexOf(Math.max(...ps)) === outcome) correct++;
    brier += ps.reduce((s, p, i) => s + (p - Number(i === outcome)) ** 2, 0);
    logLoss -= Math.log(Math.max(1e-15, ps[outcome]));
    ps.forEach((p, i) => {
      const bin = calibration[Math.min(9, Math.floor(p * 10))];
      bin.count++;
      bin.predicted += p;
      bin.actual += Number(i === outcome);
      const own = calibrationByOutcome[i][Math.min(9, Math.floor(p * 10))];
      own.count++;
      own.predicted += p;
      own.actual += Number(i === outcome);
    });
  }
  return {
    sample: rows.length,
    accuracy: correct / rows.length,
    brier: brier / rows.length,
    logLoss: logLoss / rows.length,
    goalSample,
    homeGoalMae: goalSample ? homeMae / goalSample : null,
    awayGoalMae: goalSample ? awayMae / goalSample : null,
    totalGoalMae: goalSample ? totalMae / goalSample : null,
    scoreSample,
    exactScoreAccuracy: scoreSample ? exact / scoreSample : null,
    calibrationByOutcome: calibrationByOutcome.map((bins) =>
      bins
        .filter((b) => b.count)
        .map((b) => ({
          ...b,
          predicted: b.predicted / b.count,
          actual: b.actual / b.count,
        })),
    ),
    calibrationError:
      calibration.reduce((sum, b) => sum + Math.abs(b.predicted - b.actual), 0) / (rows.length * 3),
    calibration: calibration
      .filter((b) => b.count)
      .map((b) => ({ ...b, predicted: b.predicted / b.count, actual: b.actual / b.count })),
  };
}
