import { localEntity } from '@/services/football/catalog';
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const row = await localEntity('match', (await context.params).id);
  return Response.json(row ?? { error: 'Match introuvable' }, { status: row ? 200 : 404 });
}
