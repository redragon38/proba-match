import { monitoredRoute } from '@/services/telemetry';
import { matchesOnDate } from '@/services/football/catalog';
async function get(request: Request) {
  const date =
    new URL(request.url).searchParams.get('date') ?? new Date().toISOString().slice(0, 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(Date.parse(date)) ||
    new Date(date).toISOString().slice(0, 10) !== date
  )
    return Response.json({ error: 'Date invalide' }, { status: 400 });
  return Response.json(await matchesOnDate(date), {
    headers: {
      'Cache-Control': 'public, max-age=5, stale-while-revalidate=15',
      'Vercel-CDN-Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30',
    },
  });
}

export const GET = monitoredRoute('/api/matches/today', get);
