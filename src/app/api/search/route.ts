import { monitoredRoute } from '@/services/telemetry';
import { getDataset } from '@/services/football';
import { searchAutocomplete, normalizeSearch, searchResults } from '@/services/search-index';
import { readJsonBody } from '@/lib/request-body';
async function get(request: Request) {
  const params = new URL(request.url).searchParams;
  const q = normalizeSearch(params.get('q') ?? '');
  if (params.get('scope') === 'catalogue') {
    if (q.length > 100) return Response.json({ error: 'Recherche trop longue.' }, { status: 400 });
    return Response.json(
      searchResults(await getDataset(), {
        q,
        category: params.get('category') ?? 'all',
        offset: Number(params.get('offset') ?? 0),
      }),
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
  if (q.length < 2 || q.length > 100) return Response.json({ results: [] });
  const data = await getDataset();
  const results = searchAutocomplete(data, q);
  return Response.json({ results }, { headers: { 'Cache-Control': 'private, max-age=15' } });
}

/** Read-only lookup: local favourite identifiers never appear in a shared cache or URL. */
export async function POST(request: Request) {
  const body = await readJsonBody(request, 1_000_000);
  if (!body.ok) return body.response;
  const input = body.value;
  if (
    !input ||
    typeof input !== 'object' ||
    !('ids' in input) ||
    !Array.isArray(input.ids) ||
    input.ids.some((id: unknown) => typeof id !== 'string' || id.length > 200)
  ) {
    return Response.json({ error: 'Favoris invalides.' }, { status: 400 });
  }
  const options = input as { ids: string[]; q?: unknown; category?: unknown; offset?: unknown };
  if (options.q !== undefined && (typeof options.q !== 'string' || options.q.length > 100)) {
    return Response.json({ error: 'Recherche invalide.' }, { status: 400 });
  }
  return Response.json(
    searchResults(await getDataset(), {
      ids: options.ids,
      q: options.q as string | undefined,
      category: typeof options.category === 'string' ? options.category : 'all',
      offset: typeof options.offset === 'number' ? options.offset : 0,
    }),
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}

export const GET = monitoredRoute('/api/search', get);
