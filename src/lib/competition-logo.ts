import type { Competition } from '@/types/football';

const logos: Record<string, string> = {
  'liga-portugal': 'liga-portugal',
  eredivisie: 'eredivisie',
  brasileirão: 'brasileirao',
  'saudi-pro-league': 'saudi-pro-league',
  'major-league-soccer': 'major-league-soccer',
  'ligue-1': 'ligue-1',
  'premier-league': 'premier-league',
  bundesliga: 'bundesliga',
  'la-liga': 'la-liga',
  laliga: 'la-liga',
  'serie-a': 'serie-a',
  'champions-league': 'champions-league',
  'uefa-champions-league': 'champions-league',
};

/** Exact competition names; unknown competitions keep their provider logo or flag. */
export function competitionLogo(competition: Pick<Competition, 'name' | 'logo'>) {
  const key = competition.name.toLowerCase().trim().replace(/\s+/g, '-');
  const asset = logos[key];
  return asset ? `/competition-logos/${asset}.webp` : competition.logo;
}
