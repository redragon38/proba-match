import { monitoredRoute } from '@/services/telemetry';
import { getDataset } from '@/services/football';
import { matchSelection, upcomingSelection } from '@/services/football/match-selection';
async function get(request: Request) {
  const q = Object.fromEntries(new URL(request.url).searchParams);
  const data = await getDataset();
  try {
    const featured = q.featured === 'true' ? upcomingSelection(data) : null;
    const selection = featured
      ? { matches: featured, total: featured.length }
      : matchSelection(data, q);
    return Response.json(
      { source: data.source, updatedAt: data.updatedAt, ...selection },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Filtres invalides' },
      { status: 400 },
    );
  }
}

export const GET = monitoredRoute('/api/matches', get);
