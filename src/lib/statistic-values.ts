import type { MatchStat } from '@/types/football';

const counts = new Set([
  'Tirs',
  'Tirs cadrés',
  'Tirs non cadrés',
  'Tirs bloqués',
  'Tirs dans la surface',
  'Tirs hors surface',
  'Corners',
  'Fautes',
  'Cartons jaunes',
  'Cartons rouges',
  'Hors-jeu',
  'Passes',
  'Passes réussies',
  'Passes clés',
  'Passes longues',
  'Passes dans le dernier tiers',
  'Tacles',
  'Interceptions',
  'Dégagements',
  'Duels',
  'Duels gagnés',
  'Arrêts',
  'Centres',
  'Attaques',
  'Attaques dangereuses',
  'Grosses occasions',
  'Grosses occasions manquées',
]);
export function statisticValue(label: string, value: number | null | undefined, unit?: string) {
  if (
    value == null ||
    !Number.isFinite(value) ||
    value < 0 ||
    ((unit === '%' || ['Possession', 'Précision des passes', 'Field tilt'].includes(label)) &&
      value > 100) ||
    (counts.has(label) && !Number.isSafeInteger(value))
  )
    return null;
  return value;
}

/** Conflicting duplicates and impossible component counts must not pick an arbitrary value. */
export function sanitizeMatchStatistics(statistics: MatchStat[]): MatchStat[] {
  const rows = new Map<string, MatchStat>();
  for (const stat of statistics) {
    const row = {
      ...stat,
      home: statisticValue(stat.label, stat.home, stat.unit),
      away: statisticValue(stat.label, stat.away, stat.unit),
    };
    const previous = rows.get(stat.label);
    if (previous) {
      row.home = previous.home === row.home ? row.home : null;
      row.away = previous.away === row.away ? row.away : null;
      if (previous.unit !== row.unit) row.home = row.away = null;
    }
    rows.set(stat.label, row);
  }
  for (const [part, whole] of [
    ['Tirs cadrés', 'Tirs'],
    ['Passes réussies', 'Passes'],
    ['Duels gagnés', 'Duels'],
  ] as const) {
    const component = rows.get(part),
      total = rows.get(whole);
    if (!component || !total) continue;
    for (const side of ['home', 'away'] as const)
      if (component[side] != null && total[side] != null && component[side]! > total[side]!)
        component[side] = null;
  }
  return [...rows.values()].filter((row) => row.home !== null || row.away !== null);
}

/** Descriptive ratios from observed counters only; zero denominators stay unavailable. */
export function descriptiveRatios(statistics: MatchStat[]): MatchStat[] {
  const stats = sanitizeMatchStatistics(statistics);
  return [
    ['Part des tirs cadrés', 'Tirs cadrés', 'Tirs'],
    ['Passes réussies (%) calculé', 'Passes réussies', 'Passes'],
    ['Duels gagnés (%) calculé', 'Duels gagnés', 'Duels'],
  ].flatMap(([label, numerator, denominator]) => {
    if (stats.some((s) => s.label === label)) return [];
    const n = stats.find((s) => s.label === numerator),
      d = stats.find((s) => s.label === denominator);
    const ratio = (side: 'home' | 'away') =>
      n?.[side] != null && d?.[side] != null && d[side]! > 0 && n[side]! <= d[side]!
        ? (n[side]! / d[side]!) * 100
        : null;
    const home = ratio('home'),
      away = ratio('away');
    return home === null && away === null ? [] : [{ label, home, away, unit: '%' }];
  });
}
