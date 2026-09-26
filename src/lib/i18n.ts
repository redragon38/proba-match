export const dictionaries = {
  fr: {
    brand: 'Proba Match',
    matches: 'Matchs',
    live: 'En direct',
    demo: 'Mode démonstration',
    missing: 'Données insuffisantes',
    disclaimer:
      'Les projections présentées sont des estimations statistiques et ne garantissent aucun résultat sportif.',
  },
};
export type Locale = keyof typeof dictionaries;
export const getDictionary = (locale: Locale = 'fr') => dictionaries[locale];
