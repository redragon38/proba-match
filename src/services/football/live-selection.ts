import type { Match } from '@/types/football';
export function selectLiveMatches(matches: Match[], parameters: URLSearchParams, now = Date.now()) {
  const ids = parameters.get('ids')?.split(',').slice(0, 100);
  const favorites = new Set(
    (parameters.get('favorites') ?? '').slice(0, 8000).split('|').filter(Boolean),
  );
  const targeted = favorites.size > 0;
  const selected = matches
    .filter((m) =>
      targeted
        ? [
            `match:${m.id}`,
            `team:${m.homeId}`,
            `team:${m.awayId}`,
            `competition:${m.competitionId}`,
          ].some((id) => favorites.has(id)) &&
          (favorites.has(`match:${m.id}`) || Math.abs(Date.parse(m.kickoff) - now) < 3 * 86400000)
        : ids
          ? ids.includes(m.id)
          : Math.abs(Date.parse(m.kickoff) - now) < 3 * 86400000,
    )
    .sort(
      (a, b) =>
        Number(b.status === 'live') - Number(a.status === 'live') ||
        Date.parse(b.kickoff) - Date.parse(a.kickoff) ||
        a.id.localeCompare(b.id),
    );
  return {
    matches: targeted ? selected : selected.slice(0, 100),
    truncated: !targeted && selected.length > 100,
    total: selected.length,
  };
}
