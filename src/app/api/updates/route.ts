import { db } from '@/database/client';
export async function GET() {
  if (!process.env.DATABASE_URL) return Response.json({ revision: null });
  try {
    const row = await db.cacheEntry.findUnique({
      where: { key: 'football:dataset' },
      select: { updatedAt: true },
    });
    return Response.json(
      { revision: row?.updatedAt.toISOString() ?? null },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return Response.json({ error: 'Base indisponible' }, { status: 503 });
  }
}
