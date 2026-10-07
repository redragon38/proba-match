import type { Prediction } from '@/types/football';
import { scoreDistribution } from './poisson';
import { probabilityReading } from '@/lib/probability-format';

/** Shortest contiguous range containing at least the requested model mass, not data confidence. */
export function goalRange(probabilities: number[], coverage = 0.8) {
  if (
    !probabilities.length ||
    !Number.isFinite(coverage) ||
    coverage <= 0 ||
    coverage > 1 ||
    probabilities.some((p) => !Number.isFinite(p) || p < 0) ||
    Math.abs(probabilities.reduce((sum, p) => sum + p, 0) - 1) > 1e-8
  )
    throw new Error('INVALID_GOAL_RANGE');
  let best = { from: 0, to: probabilities.length - 1, probability: 1 };
  for (let from = 0; from < probabilities.length; from++) {
    let probability = 0;
    for (let to = from; to < probabilities.length; to++) {
      probability += probabilities[to];
      if (probability + 1e-12 < coverage) continue;
      if (
        to - from < best.to - best.from ||
        (to - from === best.to - best.from && probability > best.probability)
      )
        best = { from, to, probability };
      break;
    }
  }
  return best;
}

export function predictionInsights(prediction: Prediction) {
  const distribution = scoreDistribution(prediction.expectedHome, prediction.expectedAway);
  const totalGoals = [0, 0, 0, 0, 0, 0];
  const margin = [0, 0, 0, 0];
  let homeScores = 0;
  let awayScores = 0;
  let bothScore = 0;
  const homeGoals = [0, 0, 0, 0];
  const awayGoals = [0, 0, 0, 0];
  const exactTotal = Array<number>(61).fill(0);
  const scoreGrid = Array.from({ length: 5 }, () => Array<number>(5).fill(0));
  const winningMargins = { home: [0, 0, 0], away: [0, 0, 0] };
  for (const score of distribution.scores) {
    const { home, away, probability } = score;
    totalGoals[Math.min(5, home + away)] += probability;
    exactTotal[home + away] += probability;
    homeGoals[Math.min(3, home)] += probability;
    awayGoals[Math.min(3, away)] += probability;
    scoreGrid[Math.min(4, home)][Math.min(4, away)] += probability;
    if (home > away) winningMargins.home[Math.min(2, home - away - 1)] += probability;
    if (away > home) winningMargins.away[Math.min(2, away - home - 1)] += probability;
    margin[Math.min(3, Math.abs(home - away))] += probability;
    if (home > 0) homeScores += probability;
    if (away > 0) awayScores += probability;
    if (home > 0 && away > 0) bothScore += probability;
  }
  return {
    topScores: distribution.scores.slice(0, 5),
    expectedTotal: prediction.expectedHome + prediction.expectedAway,
    homeScores,
    awayScores,
    bothScore,
    cleanHome: 1 - awayScores,
    cleanAway: 1 - homeScores,
    totalGoals,
    margin,
    homeGoals,
    awayGoals,
    scoreGrid,
    winningMargins,
    totalRange: goalRange(exactTotal),
    totalAtLeast: [2, 3, 4].map((goals) => ({
      goals,
      probability: exactTotal.slice(goals).reduce((sum, p) => sum + p, 0),
    })),
  };
}

export function predictionExplanation(prediction: Prediction, homeName: string, awayName: string) {
  const reading = probabilityReading(prediction.home, prediction.draw, prediction.away);
  if (!reading) return { balance: 'Non disponible', summary: 'Probabilités non disponibles.' };
  const balance = reading.label;
  const leader = reading.leader === 0 ? 'home' : reading.leader === 2 ? 'away' : 'neutral';
  const name = reading.leader === 0 ? homeName : reading.leader === 2 ? awayName : 'le match nul';
  const drivers = prediction.factors
    .filter((factor) => factor.side === leader)
    .slice(0, 3)
    .map((factor) => factor.label.toLowerCase());
  const reason = drivers.length
    ? `Les facteurs observés qui vont dans ce sens sont ${drivers.join(', ')}.`
    : 'Aucun facteur détaillé n’est disponible pour cette estimation.';
  const summary = !reading.emphasize
    ? `Aucune issue ne se détache nettement selon le modèle. ${reason}`
    : reading.leader === 1
      ? `Le match nul est l’issue individuelle la plus probable selon le modèle. ${reason}`
      : `${balance} pour ${name} selon le modèle. ${reason}`;
  return { balance, summary };
}

export function informationQuality(prediction: Prediction, degraded = false) {
  const reasons: string[] = [];
  if (prediction.sample < 10)
    reasons.push(`Seulement ${prediction.sample} résultats récents par équipe au minimum.`);
  if (!prediction.lineupConfirmed)
    reasons.push('Compositions officielles absentes de cette estimation.');
  if (degraded) reasons.push('La dernière synchronisation des données est en retard.');
  reasons.push('xG, absences et qualité du mapping ne sont pas validés dans cette estimation.');
  const level = degraded || prediction.confidence < 50 ? 'Faible' : 'Moyenne';
  return { level, reasons };
}
