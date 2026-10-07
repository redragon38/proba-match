import { isoDate, isoDateTime, playerBirthDate } from './factual-dates';
import type { Dataset, Match, Player, Team } from '@/types/football';
import { absoluteUrl } from './seo';
import { matchFactSummary } from './match-facts';

export function structuredImage(value: string | undefined) {
  if (!value) return undefined;
  try {
    const local = value.startsWith('/') && !value.startsWith('//');
    const url = new URL(local ? absoluteUrl(value) : value);
    if (
      url.username ||
      url.password ||
      (local && url.origin !== new URL(absoluteUrl('/')).origin) ||
      (!local && url.protocol !== 'https:')
    )
      return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}
export function teamStructuredData(team: Team) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SportsTeam',
    '@id': absoluteUrl(`/equipe/${team.slug}#team`),
    name: team.name,
    sport: 'Football',
    url: absoluteUrl(`/equipe/${team.slug}`),
    mainEntityOfPage: absoluteUrl(`/equipe/${team.slug}`),
    ...(structuredImage(team.logo) ? { logo: structuredImage(team.logo) } : {}),
  };
}
export function playerStructuredData(player: Player, team: Team | undefined) {
  const birthDate = playerBirthDate(player.birthDate);
  const image = structuredImage(player.photo);
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': absoluteUrl(`/joueur/${player.slug}#player`),
    url: absoluteUrl(`/joueur/${player.slug}`),
    mainEntityOfPage: absoluteUrl(`/joueur/${player.slug}`),
    name: player.name,
    ...(birthDate ? { birthDate } : {}),
    ...(image ? { image } : {}),
    ...(player.nationality
      ? { nationality: { '@type': 'Country', name: player.nationality } }
      : {}),
    ...(team
      ? {
          memberOf: {
            '@type': 'SportsTeam',
            '@id': absoluteUrl(`/equipe/${team.slug}#team`),
            name: team.name,
            url: absoluteUrl(`/equipe/${team.slug}`),
          },
        }
      : {}),
  };
}
export function matchStartDate(match: Match) {
  if (match.kickoffKnown === false) return isoDate(match.sourceDate);
  return isoDateTime(match.kickoff);
}
export function matchStructuredData(match: Match, data: Pick<Dataset, 'teams' | 'competitions'>) {
  const home = data.teams.find((t) => t.id === match.homeId),
    away = data.teams.find((t) => t.id === match.awayId);
  if (!home || !away) return null;
  const competition = data.competitions.find((c) => c.id === match.competitionId);
  const startDate = matchStartDate(match);
  const eventStatus =
    match.status === 'cancelled'
      ? 'https://schema.org/EventCancelled'
      : match.status === 'postponed'
        ? 'https://schema.org/EventPostponed'
        : match.status === 'abandoned'
          ? undefined
          : 'https://schema.org/EventScheduled';
  const entity = (team: Team) => ({
    '@type': 'SportsTeam',
    '@id': absoluteUrl(`/equipe/${team.slug}#team`),
    name: team.name,
    url: absoluteUrl(`/equipe/${team.slug}`),
  });
  return {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    '@id': absoluteUrl(`/match/${match.slug}#event`),
    url: absoluteUrl(`/match/${match.slug}`),
    mainEntityOfPage: absoluteUrl(`/match/${match.slug}`),
    name: `${home.name} – ${away.name}`,
    description: matchFactSummary(match, home.name, away.name, competition?.name ?? 'Football'),
    sport: 'Football',
    ...(startDate ? { startDate } : {}),
    ...(eventStatus ? { eventStatus } : {}),
    ...(match.venue ? { location: { '@type': 'Place', name: match.venue } } : {}),
    homeTeam: entity(home),
    awayTeam: entity(away),
  };
}
