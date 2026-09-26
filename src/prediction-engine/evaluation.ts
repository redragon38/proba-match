import type { EvaluatedPrediction } from '@/types/football';
export function metrics(rows: EvaluatedPrediction[]) {
  if (!rows.length) return null;
  let correct = 0,
    brier = 0,
    logLoss = 0;
  const calibration = Array.from({ length: 10 }, (_, i) => ({
    bin: i,
    count: 0,
    predicted: 0,
    actual: 0,
  }));
  for (const r of rows) {
    const ps = [r.prediction.home, r.prediction.draw, r.prediction.away],
      outcome = r.homeScore > r.awayScore ? 0 : r.homeScore === r.awayScore ? 1 : 2;
    if (ps.indexOf(Math.max(...ps)) === outcome) correct++;
    brier += ps.reduce((s, p, i) => s + (p - Number(i === outcome)) ** 2, 0);
    logLoss -= Math.log(Math.max(1e-15, ps[outcome]));
    ps.forEach((p, i) => {
      const bin = calibration[Math.min(9, Math.floor(p * 10))];
      bin.count++;
      bin.predicted += p;
      bin.actual += Number(i === outcome);
    });
  }
  return {
    sample: rows.length,
    accuracy: correct / rows.length,
    brier: brier / rows.length,
    logLoss: logLoss / rows.length,
    calibration: calibration
      .filter((b) => b.count)
      .map((b) => ({ ...b, predicted: b.predicted / b.count, actual: b.actual / b.count })),
  };
}
