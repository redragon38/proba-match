import type { Prediction } from '@/types/football';
import { scoreDistribution } from './poisson';

export function predictionInsights(prediction: Prediction) {
  const distribution = scoreDistribution(prediction.expectedHome, prediction.expectedAway);
  const totalGoals = [0, 0, 0, 0, 0, 0];
  const margin = [0, 0, 0, 0];
  let homeScores = 0;
  let awayScores = 0;
  let bothScore = 0;
  for (const score of distribution.scores) {
    const { home, away, probability } = score;
    totalGoals[Math.min(5, home + away)] += probability;
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
  };
}

export function predictionExplanation(
  prediction: Prediction,
  homeName: string,
  awayName: string,
) {
  const difference = Math.abs(prediction.home - prediction.away);
  const balance =
    difference < 0.05
      ? 'Très équilibré'
      : difference < 0.12
        ? 'Équilibré'
        : difference < 0.25
          ? 'Léger avantage'
          : 'Avantage marqué';
  const leader = prediction.home > prediction.away ? 'home' : 'away';
  const name = leader === 'home' ? homeName : awayName;
  const drivers = prediction.factors
    .filter((factor) => factor.side === leader)
    .slice(0, 3)
    .map((factor) => factor.label.toLowerCase());
  const reason = drivers.length
    ? `Les facteurs observés qui vont dans ce sens sont ${drivers.join(', ')}.`
    : 'L’estimation combine les buts récents, la force des adversaires, la forme et le contexte domicile/extérieur.';
  const summary =
    difference < 0.05
      ? `Les deux équipes sont très proches selon le modèle. ${reason}`
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
  const level =
    degraded || prediction.confidence < 50
      ? 'Faible'
      : prediction.confidence < 70 || !prediction.lineupConfirmed
        ? 'Moyenne'
        : 'Élevée';
  return { level, reasons };
}
