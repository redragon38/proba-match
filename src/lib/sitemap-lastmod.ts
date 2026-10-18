import type { Dataset, Match } from '@/types/football';
import { validResult } from '@/prediction-engine/availability';

function latest(values: Array<string | undefined>) {
  return values
    .filter((value): value is string => Boolean(value) && Number.isFinite(Date.parse(value!)))
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0];
}

/** Only timestamps tied to a visible, significant content change qualify for sitemap lastmod. */
export function matchContentModifiedAt(match: Match) {
  return latest([
    validResult(match) ? match.resultObservedAt : undefined,
    match.events.length ? match.detailObservedAt?.events : undefined,
    match.lineups.length ? match.detailObservedAt?.lineups : undefined,
    match.statistics.length ? match.detailObservedAt?.statistics : undefined,
    match.performances?.length ? match.detailObservedAt?.performances : undefined,
  ]);
}

export function entityContentModifiedAt(path: string, data: Dataset) {
  if (path.startsWith('/match/')) {
    const slug = path.slice('/match/'.length);
    const match = data.matches.find((item) => item.slug === slug);
    return match && matchContentModifiedAt(match);
  }
  if (path.startsWith('/equipe/')) {
    const slug = path.slice('/equipe/'.length);
    const team = data.teams.find((item) => item.slug === slug);
    return team
      ? latest(
          data.matches
            .filter((match) => match.homeId === team.id || match.awayId === team.id)
            .map(matchContentModifiedAt),
        )
      : undefined;
  }
  if (path.startsWith('/competition/')) {
    const slug = path.slice('/competition/'.length);
    const competition = data.competitions.find((item) => item.slug === slug);
    return competition
      ? latest(
          data.matches
            .filter((match) => match.competitionId === competition.id)
            .map(matchContentModifiedAt),
        )
      : undefined;
  }
  return undefined;
}
