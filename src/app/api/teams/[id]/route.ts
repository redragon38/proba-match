import { localEntity } from '@/services/football/catalog';
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const row = await localEntity('team', (await context.params).id);
  return Response.json(row ?? { error: 'Équipe introuvable' }, { status: row ? 200 : 404 });
}
