import { absoluteUrl, publicPages } from './seo';

// Content review date, changed only when these published explanations are revised.
export const editorialReviewedAt = '2026-10-05';
export function editorialReviewDate(path: string) {
  return ['/methodologie', '/comprendre-probabilites', '/sources-donnees'].includes(path)
    ? '2026-10-06'
    : editorialReviewedAt;
}
export const probabilityQuestions = [
  {
    question: 'Une équipe favorite gagne-t-elle forcément ?',
    answer:
      'Non. Une probabilité de victoire de 60 % laisse 40 % pour le nul ou la défaite selon le modèle. Elle ne garantit ni le résultat, ni un taux de réussite déjà mesuré.',
  },
  {
    question: 'Pourquoi le score le plus probable a-t-il une faible probabilité ?',
    answer:
      'De nombreux scores se partagent la distribution. Le score individuel le mieux classé peut ne représenter qu’une petite part des scénarios. Il faut lire sa probabilité et les autres scores proposés.',
  },
  {
    question: 'Les buts attendus Proba Match sont-ils des xG ?',
    answer:
      'Non. Les buts attendus sont une moyenne estimée avant le match à partir de l’historique. Les xG décrivent la qualité d’occasions de tir et nécessitent des données de tirs.',
  },
  {
    question: 'Que signifie la qualité des informations ?',
    answer:
      'Elle décrit notamment la quantité et la récence de l’historique et la disponibilité des compositions. Ce niveau qualitatif ne mesure pas la probabilité que la prédiction soit correcte.',
  },
  {
    question: 'Pourquoi certaines prédictions sont-elles indisponibles ?',
    answer:
      'Le moteur exige au moins cinq résultats antérieurs disponibles par équipe, ainsi qu’une quantité effective suffisante après pondération. Plusieurs résultats très anciens peuvent peser moins que cinq matchs bien documentés. Le dernier résultat ne doit pas remonter à plus de 180 jours. Une heure inconnue ou un score réglementaire non confirmé peut aussi bloquer l’estimation.',
  },
  {
    question: 'Proba Match connaît-il déjà son exactitude réelle ?',
    answer:
      'Le moteur peut être évalué avec des prédictions archivées et des tests temporels. Les résultats reconstruits sans timestamps réels de disponibilité restent exploratoires. Ils ne certifient pas la précision en production.',
  },
];
export const footballTerms = [
  {
    id: '1n2',
    name: '1N2',
    definition:
      'Les trois issues d’un match : victoire domicile (1), nul (N) et victoire extérieur (2). Dans Proba Match, leurs pourcentages affichés totalisent 100 % après arrondi.',
    caution: 'L’issue la plus probable peut rester moins probable que les deux autres réunies.',
  },
  {
    id: 'buts-attendus',
    name: 'Buts attendus',
    definition:
      'Moyenne de buts estimée pour une équipe par le modèle avant le match. Elle résume une distribution de scores possibles.',
    caution: 'Une moyenne de 1,4 but n’est pas un score précis et n’est pas une mesure de tirs xG.',
  },
  {
    id: 'score-probable',
    name: 'Score le plus probable',
    definition:
      'Score individuel auquel le modèle attribue la plus grande probabilité dans sa distribution.',
    caution:
      'Son rang ne garantit pas sa réalisation. Plusieurs scores peuvent avoir des probabilités voisines.',
  },
  {
    id: 'poisson',
    name: 'Distribution de Poisson',
    definition:
      'Modèle qui transforme une moyenne de buts en probabilités de marquer 0, 1, 2 buts ou davantage. Proba Match combine les distributions des deux équipes.',
    caution:
      'L’indépendance des deux distributions est une hypothèse du modèle, pas une propriété certaine du football.',
  },
  {
    id: 'elo',
    name: 'Elo',
    definition:
      'Estimation de force relative mise à jour avec les résultats et la force des adversaires. Le moteur tient aussi compte du terrain et de l’écart de buts.',
    caution: 'Un Elo n’est ni une place au classement, ni une probabilité de victoire à lui seul.',
  },
  {
    id: 'forme',
    name: 'Forme récente pondérée',
    definition:
      'Lecture des performances récentes qui accorde plus de poids aux matchs récents et tient compte des adversaires.',
    caution:
      'Cinq victoires ne décrivent pas la même performance selon les adversaires et les lieux des rencontres.',
  },
  {
    id: 'clean-sheet',
    name: 'Clean sheet',
    definition:
      'Une équipe termine la rencontre sans encaisser de but. Pour le domicile, cela signifie zéro but marqué par l’équipe extérieure.',
    caution: 'Un clean sheet peut accompagner une victoire ou un nul 0–0.',
  },
  {
    id: 'les-deux-marquent',
    name: 'Les deux équipes marquent',
    definition:
      'Événement où chaque équipe marque au moins une fois. Il regroupe notamment 1–1, 2–1, 1–2 et les scores plus élevés des deux côtés.',
    caution: 'Ce n’est pas la probabilité d’un score précis.',
  },
  {
    id: 'total-buts',
    name: 'Total de buts',
    definition:
      'Somme des buts des deux équipes. « Au moins trois buts » regroupe tous les scores dont la somme vaut trois ou davantage.',
    caution:
      'Les événements « au moins deux » et « au moins trois » se recouvrent ; on ne doit pas additionner leurs probabilités.',
  },
  {
    id: 'marge',
    name: 'Marge de victoire',
    definition:
      'Différence de buts entre le gagnant et le perdant. Les lectures par équipe regroupent les victoires par un, deux ou trois buts et plus.',
    caution:
      'Dans Proba Match, ces probabilités portent sur toutes les issues, sans supposer que l’équipe gagne déjà.',
  },
  {
    id: 'plage-buts',
    name: 'Plage de buts',
    definition:
      'Intervalle contigu de totaux de buts couvrant au moins la part annoncée de la distribution calculée, avec une largeur aussi courte que possible.',
    caution:
      'La masse du modèle n’est ni une garantie de couverture réelle, ni un indice de qualité des données.',
  },
  {
    id: 'confiance',
    name: 'Qualité des informations',
    definition:
      'Niveau qualitatif décrivant l’historique disponible, sa fraîcheur et les informations connues au moment du calcul.',
    caution: 'Il ne faut pas le confondre avec une probabilité d’événement ou un taux de réussite.',
  },
  {
    id: 'xg',
    name: 'xG — expected goals',
    definition:
      'Mesure de la qualité des occasions fondée sur les caractéristiques des tirs. Les méthodes et données peuvent différer selon les fournisseurs.',
    caution:
      'Les xG observés après un match ne peuvent pas alimenter une prédiction pré-match de ce même match.',
  },
  {
    id: 'possession',
    name: 'Possession',
    definition:
      'Part de possession du ballon attribuée à chaque équipe par le fournisseur de statistiques.',
    caution:
      'La méthode varie selon la source. Une possession supérieure n’implique pas une meilleure probabilité de gagner.',
  },
  {
    id: 'tirs-cadres',
    name: 'Part des tirs cadrés',
    definition:
      'Nombre de tirs cadrés divisé par le nombre de tirs, si les deux compteurs sont disponibles et cohérents.',
    caution: 'Un total de tirs nul ne donne pas un pourcentage de précision calculable.',
  },
  {
    id: 'passes',
    name: 'Passes réussies',
    definition:
      'Passes complétées rapportées au total des passes lorsque les compteurs observés sont disponibles et cohérents.',
    caution:
      'Les définitions fournisseur peuvent différer. Ce ratio descriptif n’ajuste pas les probabilités du moteur.',
  },
  {
    id: 'ppda',
    name: 'PPDA',
    definition:
      'Nombre de passes adverses par action défensive dans les zones et avec les actions définies par le fournisseur. Il décrit un aspect de l’intensité du pressing.',
    caution:
      'Un PPDA plus bas suggère généralement un pressing plus intense, pas une meilleure équipe dans toutes les situations.',
  },
  {
    id: 'par-90',
    name: 'Statistique par 90 minutes',
    definition:
      'Valeur divisée par les minutes jouées puis multipliée par 90, pour comparer des temps de jeu différents.',
    caution:
      'Les faibles temps de jeu peuvent produire des valeurs instables. Le poste et le contexte restent importants.',
  },
  {
    id: 'calibration',
    name: 'Calibration',
    definition:
      'Accord entre les probabilités annoncées et les fréquences observées sur un ensemble de prédictions comparables.',
    caution:
      'Un seul résultat et une proximité des moyennes globales ne suffisent pas à vérifier la calibration.',
  },
  {
    id: 'brier',
    name: 'Brier Score',
    definition:
      'Moyenne des écarts au carré entre probabilités et événements observés. Dans l’évaluation 1N2 du projet, les trois écarts sont additionnés pour chaque match.',
    caution:
      'Plus bas est meilleur sur le même échantillon. Un Brier binaire et un Brier 1N2 ne sont pas directement comparables.',
  },
  {
    id: 'log-loss',
    name: 'Log Loss',
    definition:
      'Mesure fondée sur la probabilité attribuée à l’issue effectivement observée. Elle pénalise fortement une issue réelle à laquelle le modèle attribuait très peu de probabilité.',
    caution:
      'Plus bas est meilleur sur les mêmes matchs, sans transformer la valeur en pourcentage de réussite.',
  },
  {
    id: 'mae',
    name: 'MAE — erreur absolue moyenne',
    definition:
      'Moyenne des écarts absolus entre buts attendus et buts réellement marqués. Elle peut être calculée pour le domicile, l’extérieur ou le total.',
    caution: 'Elle évalue les moyennes de buts, pas toute la distribution de scores.',
  },
  {
    id: 'backtest',
    name: 'Backtest temporel',
    definition:
      'Évaluation qui avance chronologiquement et n’utilise pour chaque prédiction que les informations disponibles auparavant.',
    caution:
      'Un classement recalculé, une composition tardive ou un résultat publié après le calcul peuvent créer une fuite de données futures.',
  },
  {
    id: 'manquant',
    name: 'Donnée indisponible',
    definition:
      'Information absente ou non exploitable à la date retenue. Proba Match la distingue d’une valeur réellement observée égale à zéro.',
    caution: 'Remplacer arbitrairement une donnée manquante par zéro crée une fausse précision.',
  },
];
export function editorialPageData(path: string, type = 'WebPage') {
  const [name, description] = publicPages[path];
  return {
    '@context': 'https://schema.org',
    '@type': type,
    '@id': absoluteUrl(`${path}#page`),
    url: absoluteUrl(path),
    name,
    description,
    inLanguage: 'fr',
    dateModified: editorialReviewDate(path),
    isPartOf: { '@id': absoluteUrl('/#website') },
    about: { '@id': absoluteUrl('/#organization') },
  };
}
export function probabilityFaqData() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': absoluteUrl('/comprendre-probabilites#questions'),
    isPartOf: { '@id': absoluteUrl('/comprendre-probabilites#page') },
    mainEntity: probabilityQuestions.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  };
}
export function glossaryData() {
  return {
    ...editorialPageData('/lexique-football', 'DefinedTermSet'),
    hasDefinedTerm: footballTerms.map(({ id, name, definition, caution }) => ({
      '@type': 'DefinedTerm',
      '@id': absoluteUrl(`/lexique-football#${id}`),
      url: absoluteUrl(`/lexique-football#${id}`),
      name,
      description: `${definition} ${caution}`,
      inDefinedTermSet: absoluteUrl('/lexique-football#page'),
    })),
  };
}
