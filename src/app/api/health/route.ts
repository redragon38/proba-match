import { verifySecret } from '@/lib/auth';
import { footballHealth } from '@/services/football/health';

const headers = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };

export async function GET(request: Request) {
  if (
    !verifySecret(
      request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '',
      process.env.CRON_SECRET,
    )
  )
    return Response.json({ error: 'Non autorisé' }, { status: 401, headers });
  try {
    const health = await footballHealth();
    return Response.json(health, { status: health.status === 'fail' ? 503 : 200, headers });
  } catch {
    return Response.json(
      { status: 'fail', issues: ['HEALTH_CHECK_UNAVAILABLE'] },
      { status: 503, headers },
    );
  }
}
