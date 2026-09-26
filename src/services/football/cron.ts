import { verifySecret } from '@/lib/auth';
export function cronHandler(work: () => Promise<unknown>) {
  return async (request: Request) => {
    if (
      !verifySecret(
        request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '',
        process.env.CRON_SECRET,
      )
    )
      return Response.json({ error: 'Non autorisé' }, { status: 401 });
    try {
      return Response.json(await work());
    } catch {
      return Response.json(
        { error: 'Synchronisation indisponible. Consultez le journal.' },
        { status: 503 },
      );
    }
  };
}
