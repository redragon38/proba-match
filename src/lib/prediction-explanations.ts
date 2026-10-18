import type { Prediction } from '@/types/football';

/** Translate recorded factor directions only; never invent a numerical contribution. */
export function plainFactor(factor: Prediction['factors'][number], home: string, away: string) {
  const team = factor.side === 'home' ? home : factor.side === 'away' ? away : null;
  if (factor.label === 'Récence et échantillon')
    return 'Les matchs récents comptent davantage que les anciens ; le calcul reste limité à l’historique disponible.';
  if (!team) return null;
  switch (factor.label) {
    case 'Production offensive récente':
      return `${team} a une production offensive récente plus élevée après pondération du lieu, de la date et des adversaires.`;
    case 'Résistance défensive récente':
      return `${team} présente moins de buts encaissés dans l’historique pondéré retenu.`;
    case 'Niveau Elo et terrain':
      return `Le niveau de force Elo, combiné à l’effet du terrain, penche du côté de ${team}. Elo mesure une force estimée, pas une position au classement.`;
    case 'Forme ajustée aux adversaires':
      return `Les résultats récents de ${team}, comparés à ceux attendus contre ses adversaires, sont plus favorables.`;
    default:
      return null;
  }
}

export type PredictionInfluences = {
  title: string;
  favorable: string[];
  unfavorable: string[];
  neutral: string[];
  limits: string[];
};

/** Build a stable explanation exclusively from the factors saved with the forecast. */
export function predictionInfluences(
  prediction: Prediction,
  home: string,
  away: string,
): PredictionInfluences {
  const outcomes = [prediction.home, prediction.draw, prediction.away];
  const leader = outcomes.indexOf(Math.max(...outcomes));
  const favoredSide = leader === 0 ? 'home' : leader === 2 ? 'away' : 'neutral';
  const favorite = leader === 0 ? home : leader === 2 ? away : 'le match nul';
  const favorable: string[] = [];
  const unfavorable: string[] = [];
  const neutral: string[] = [];

  for (const factor of prediction.factors) {
    const text = plainFactor(factor, home, away);
    if (!text) continue;
    if (!factor.side || factor.side === 'neutral') neutral.push(text);
    else if (factor.side === favoredSide) favorable.push(text);
    else unfavorable.push(text);
  }

  const limits = [
    `Historique utilisé : au moins ${prediction.sample} matchs récents par équipe.`,
    prediction.effectiveSample == null
      ? null
      : `Après pondération de la récence et du lieu, l’échantillon effectif minimal est de ${prediction.effectiveSample.toFixed(1)} matchs.`,
    prediction.lineupConfirmed
      ? null
      : 'Les compositions officielles ne faisaient pas partie des informations disponibles lors du calcul.',
    'Les absences, la météo et la fatigue ne sont pas utilisées par cette version du modèle.',
  ].filter((value): value is string => Boolean(value));

  return {
    title:
      favoredSide === 'neutral'
        ? 'Pourquoi le match paraît-il équilibré ?'
        : `Pourquoi ${favorite} a la probabilité la plus élevée ?`,
    favorable,
    unfavorable,
    neutral,
    limits,
  };
}
