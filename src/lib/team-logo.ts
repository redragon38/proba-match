import logos from './team-logos.json';
import type { Team } from '@/types/football';
/** Exact country/name registry: never guess another club's crest from a fuzzy name. */
export function teamLogo(team: Pick<Team, 'name' | 'country' | 'logo'>): string | undefined {
  const name = team.name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  return team.logo || (logos as Record<string, string>)[`${team.country}:${name}`];
}
