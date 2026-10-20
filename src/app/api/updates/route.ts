import { db } from '@/database/client';
const headers = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };
export async function GET() {
  if (!process.env.DATABASE_URL) return Response.json({ revision: null }, { headers });
  try {
    const row = await db.cacheEntry.findUnique({
      where: { key: 'football:dataset' },
      select: { updatedAt: true },
    });
    return Response.json(
      { revision: row?.updatedAt.toISOString() ?? null },
      {
        headers,
      },
    );
  } catch {
    return Response.json({ error: 'Base indisponible' }, { status: 503, headers });
  }
}
