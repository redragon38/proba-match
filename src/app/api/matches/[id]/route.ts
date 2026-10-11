import { localEntity } from '@/services/football/catalog';
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const id = (await context.params).id;
  if (!id || id.length > 200)
    return Response.json({ error: 'Identifiant invalide' }, { status: 400 });
  const row = await localEntity('match', id);
  const status = row && 'status' in row ? row.status : undefined;
  const ttl = status === 'live' ? 5 : status === 'finished' ? 3600 : 30;
  return Response.json(row ?? { error: 'Match introuvable' }, {
    status: row ? 200 : 404,
    headers: row
      ? {
          'Cache-Control': 'public, max-age=5, stale-while-revalidate=30',
          'Vercel-CDN-Cache-Control': `public, s-maxage=${ttl}, stale-while-revalidate=${ttl}`,
        }
      : { 'Cache-Control': 'no-store' },
  });
}
