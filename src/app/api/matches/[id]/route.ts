import { localEntity } from '@/services/football/catalog';
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const id = (await context.params).id;
  if (!id || id.length > 200)
    return Response.json({ error: 'Identifiant invalide' }, { status: 400 });
  const row = await localEntity('match', id);
  return Response.json(row ?? { error: 'Match introuvable' }, { status: row ? 200 : 404 });
}
