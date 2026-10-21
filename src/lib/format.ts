export const dateKey = (date: Date = new Date(), timeZone = 'Europe/Paris') =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
export const time = (iso: string) =>
  new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris',
  }).format(new Date(iso));
export const dayLabel = (iso: string) =>
  new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Paris',
  }).format(new Date(iso));
export const percent = (n: number) => `${Math.round(n * 100)} %`;
export const number = (n: number | null | undefined, digits = 0) =>
  n == null || !Number.isFinite(n)
    ? 'Non disponible'
    : n.toLocaleString('fr-FR', { maximumFractionDigits: digits });
export const countryLabel = (country: string) =>
  ({
    England: 'Angleterre',
    Germany: 'Allemagne',
    Spain: 'Espagne',
    Italy: 'Italie',
    France: 'France',
    Brazil: 'Brésil',
    Portugal: 'Portugal',
    USA: 'États-Unis',
    'United States': 'États-Unis',
    'Saudi Arabia': 'Arabie saoudite',
    Argentina: 'Argentine',
    Netherlands: 'Pays-Bas',
    Belgium: 'Belgique',
    Switzerland: 'Suisse',
    Croatia: 'Croatie',
    Serbia: 'Serbie',
    Morocco: 'Maroc',
    Algeria: 'Algérie',
    Japan: 'Japon',
    'South Korea': 'Corée du Sud',
    Denmark: 'Danemark',
    Sweden: 'Suède',
    Norway: 'Norvège',
    Scotland: 'Écosse',
    Wales: 'Pays de Galles',
  })[country] ?? country;
export const roundLabel = (round: string | undefined) => {
  if (!round) return 'Journée non précisée';
  const matchday = /^Matchday\s+(\d+)$/i.exec(round);
  return matchday ? `Journée ${matchday[1]}` : round;
};
export const slugify = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
