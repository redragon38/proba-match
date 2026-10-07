import { scoreDistribution } from './poisson';

/** Research-only low-score correction, eq. in https://arxiv.org/pdf/2307.02139 p.4. */
export function dixonColesDistribution(home: number, away: number, rho: number) {
  const base = scoreDistribution(home, away);
  const factors = [1 - home * away * rho, 1 + home * rho, 1 + away * rho, 1 - rho];
  if (!Number.isFinite(rho) || factors.some((factor) => !Number.isFinite(factor) || factor < 0))
    throw new Error('INVALID_DIXON_COLES_PARAMETER');
  if (rho === 0) return base;
  const scores = base.scores.map((s) => ({
    ...s,
    probability:
      s.probability *
      (s.home === 0 && s.away === 0
        ? factors[0]
        : s.home === 0 && s.away === 1
          ? factors[1]
          : s.home === 1 && s.away === 0
            ? factors[2]
            : s.home === 1 && s.away === 1
              ? factors[3]
              : 1),
  }));
  const mass = scores.reduce((sum, s) => sum + s.probability, 0);
  const result = {
    home: 0,
    draw: 0,
    away: 0,
    scores: scores.map((s) => ({ ...s, probability: s.probability / mass })),
  };
  for (const s of result.scores)
    result[s.home > s.away ? 'home' : s.home === s.away ? 'draw' : 'away'] += s.probability;
  result.scores.sort((a, b) => b.probability - a.probability);
  return result;
}
