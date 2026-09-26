import type { Dataset, Match } from '@/types/football';
import { dateKey } from '@/lib/format';

export type MatchQuery = {
  statut?: string;
  status?: string;
  date?: string;
  timezone?: string;
  pays?: string;
  competition?: string;
  page?: string;
  limit?: string;
};
export function matchSelection(data: Dataset, query: MatchQuery = {}, now = Date.now()) {
  const status = query.statut ?? query.status ?? 'all';
  if (
    !['all', 'scheduled', 'live', 'finished', 'postponed', 'cancelled', 'abandoned'].includes(
      status,
    )
  )
    throw new Error('Statut invalide');
  const zone = query.timezone ?? 'Europe/Paris';
  let dateFormatter: Intl.DateTimeFormat;
  try {
    dateFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    throw new Error('Fuseau horaire invalide');
  }
  if (
    query.date &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(query.date) ||
      !Number.isFinite(Date.parse(query.date)) ||
      new Date(query.date).toISOString().slice(0, 10) !== query.date)
  )
    throw new Error('Date invalide');
  const number = (value: string | undefined, fallback: number, max: number) => {
    if (value === undefined) return fallback;
    if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > max)
      throw new Error('Pagination invalide');
    return Number(value);
  };
  const limit = number(query.limit, 24, 100);
  const requestedPage = number(query.page, 1, 1000000);
  const today = dateKey(new Date(now));
  const rows = data.matches
    .filter(
      (m) =>
        (status === 'all' || m.status === status) &&
        (status !== 'scheduled' || isUpcoming(m, now, today)) &&
        (!query.date ||
          (m.kickoffKnown === false && m.sourceDate
            ? m.sourceDate
            : dateFormatter.format(new Date(m.kickoff))) === query.date) &&
        (!query.competition ||
          query.competition === 'all' ||
          m.competitionId === query.competition) &&
        (!query.pays ||
          query.pays === 'all' ||
          data.competitions.some((c) => c.id === m.competitionId && c.country === query.pays)),
    )
    .map((match) => ({ match, kickoff: Date.parse(match.kickoff) }))
    .sort((a, b) => {
      const x = a.kickoff,
        y = b.kickoff;
      return (
        (status === 'finished'
          ? y - x
          : status === 'all'
            ? Math.abs(x - now) - Math.abs(y - now)
            : x - y) || a.match.id.localeCompare(b.match.id)
      );
    });
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(requestedPage, pages);
  return {
    matches: rows.slice((page - 1) * limit, page * limit).map(({ match }) => matchSummary(match)),
    total,
    page,
    pages,
    limit,
    hasNextPage: page < pages,
    status,
  };
}
export function isUpcoming(m: Match, now = Date.now(), today?: string) {
  return (
    m.status === 'scheduled' &&
    (m.kickoffKnown === false && m.sourceDate
      ? m.sourceDate >= (today ?? dateKey(new Date(now)))
      : Date.parse(m.kickoff) >= now)
  );
}
/** Use a real matchday when today's calendar has no fixture for the selected tab. */
export function closestMatchDate(
  data: Pick<Dataset, 'matches'>,
  status = 'all',
  now = Date.now(),
  zone = 'Europe/Paris',
) {
  const today = dateKey(new Date(now), zone);
  let closest: Match | undefined;
  let distance = Infinity;
  for (const match of data.matches) {
    if (status === 'scheduled' ? !isUpcoming(match, now, today) : !['all', 'favorites'].includes(status) && match.status !== status)
      continue;
    const kickoff = Date.parse(match.kickoff);
    if (!Number.isFinite(kickoff)) continue;
    // Only dates near today need a timezone conversion while scanning the full corpus.
    if (Math.abs(kickoff - now) < 2 * 86400_000 && matchDate(match, zone) === today)
      return today;
    const gap = Math.abs(kickoff - now);
    if (gap < distance) {
      closest = match;
      distance = gap;
    }
  }
  return closest ? matchDate(closest, zone) : today;
}
function matchDate(match: Match, zone: string) {
  return match.kickoffKnown === false && match.sourceDate
    ? match.sourceDate
    : dateKey(new Date(match.kickoff), zone);
}
export function matchSummary(m: Match): Match {
  return { ...m, performances: undefined, lineups: [], statistics: [], events: [] };
}
/** Nearest genuine fixtures: deterministic fallback without invented popularity. */
export function upcomingSelection(data: Dataset, now = Date.now(), limit = 4) {
  const today = dateKey(new Date(now));
  return data.matches
    .filter((m) => isUpcoming(m, now, today))
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff) || a.id.localeCompare(b.id))
    .slice(0, limit)
    .map(matchSummary);
}
