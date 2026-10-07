import { monitoredRoute } from '@/services/telemetry';
import { getDataset } from '@/services/football';
import { selectLiveMatches } from '@/services/football/live-selection';
async function get(request: Request) {
  const d = await getDataset();
  const url = new URL(request.url);
  const ids = url.searchParams.get('ids')?.split(',').slice(0, 100);
  const detail = url.searchParams.get('detail') === '1' && ids?.length === 1;
  const now = Date.now();
  const selection = selectLiveMatches(d.matches, url.searchParams, now);
  return Response.json(
    {
      source: d.source,
      updatedAt: d.updatedAt,
      warning: d.warning,
      degraded: d.degraded === true,
      truncated: selection.truncated,
      total: selection.total,
      matches: selection.matches.map((m) => ({
        id: m.id,
        homeId: m.homeId,
        awayId: m.awayId,
        competitionId: m.competitionId,
        label: `${d.teams.find((t) => t.id === m.homeId)?.name} – ${d.teams.find((t) => t.id === m.awayId)?.name}`,
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        status: m.status,
        minute: m.minute ?? null,
        extra: m.extra ?? null,
        phase: m.phase,
        updatedAt: m.updatedAt,
        events: m.events,
        ...(detail
          ? { statistics: m.statistics, lineups: m.lineups, performances: m.performances }
          : {}),
        lineup: m.lineups.length === 2 && m.lineups.every((l) => l.confirmed),
      })),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export const GET = monitoredRoute('/api/live', get);
