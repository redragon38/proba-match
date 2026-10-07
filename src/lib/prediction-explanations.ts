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
