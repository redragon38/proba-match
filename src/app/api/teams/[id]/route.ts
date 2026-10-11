import { localEntity } from '@/services/football/catalog';
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const id = (await context.params).id;
  if (!id || id.length > 200)
    return Response.json({ error: 'Identifiant invalide' }, { status: 400 });
  const row = await localEntity('team', id);
  return Response.json(row ?? { error: 'Équipe introuvable' }, {
    status: row ? 200 : 404,
    headers: row
      ? {
          'Cache-Control': 'public, max-age=30, stale-while-revalidate=300',
          'Vercel-CDN-Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        }
      : { 'Cache-Control': 'no-store' },
  });
}
