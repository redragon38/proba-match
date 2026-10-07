export function poisson(lambda: number, goals: number) {
  if (!Number.isFinite(lambda) || lambda < 0 || !Number.isInteger(goals) || goals < 0)
    throw new Error('INVALID_POISSON_INPUT');
  let p = Math.exp(-lambda);
  for (let i = 1; i <= goals; i++) p *= lambda / i;
  return p;
}
export function scoreDistribution(homeLambda: number, awayLambda: number) {
  if ([homeLambda, awayLambda].some((n) => !Number.isFinite(n) || n < 0 || n > 10))
    throw new Error('INVALID_LAMBDA');
  const scores: { home: number; away: number; probability: number }[] = [];
  // Compute each mass once, rather than repeating factorial recurrence for every cell.
  const homeMass = Array.from({ length: 31 }, (_, goals) => poisson(homeLambda, goals));
  const awayMass = Array.from({ length: 31 }, (_, goals) => poisson(awayLambda, goals));
  let total = 0,
    home = 0,
    draw = 0,
    away = 0;
  for (let h = 0; h <= 30; h++)
    for (let a = 0; a <= 30; a++) {
      const probability = homeMass[h] * awayMass[a];
      total += probability;
      scores.push({ home: h, away: a, probability });
      if (h > a) home += probability;
      else if (h === a) draw += probability;
      else away += probability;
    }
  return {
    home: home / total,
    draw: draw / total,
    away: away / total,
    scores: scores
      .map((s) => ({ ...s, probability: s.probability / total }))
      .sort((a, b) => b.probability - a.probability),
  };
}
