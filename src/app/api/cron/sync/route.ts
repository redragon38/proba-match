import { verifySecret } from '@/lib/auth';
import { syncFootball } from '@/services/football/sync';
export const maxDuration = 300;
export async function GET(request: Request) {
  if (
    !verifySecret(
      request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '',
      process.env.CRON_SECRET,
    )
  )
    return Response.json({ error: 'Non autorisé' }, { status: 401 });
  try {
    const date = new URL(request.url).searchParams.get('date') ?? undefined;
    if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(new Date(date).getTime())))
      return Response.json({ error: 'Date invalide' }, { status: 400 });
    return Response.json(await syncFootball({ date }));
  } catch {
    return Response.json(
      { error: 'La synchronisation a échoué. Consultez l’administration.' },
      { status: 503 },
    );
  }
}
