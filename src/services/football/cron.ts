import { verifySecret } from '@/lib/auth';
import { verifyGithubActionsOidc } from '@/services/github-oidc';
import { log } from '@/lib/logger';
type CronAuthorization = { liveSecret?: boolean; githubOidc?: boolean };
const headers = { 'Cache-Control': 'no-store' };

/** A provider can return a partial result without throwing. It is not a successful cron. */
export function incompleteSync(value: unknown, depth = 0): boolean {
  if (!value || typeof value !== 'object' || depth > 8) return false;
  const record = value as Record<string, unknown>;
  if (['fail', 'failed', 'partial', 'error'].includes(String(record.status))) return true;
  if (typeof record.failures === 'number' && record.failures > 0) return true;
  return Object.values(record).some((child) => incompleteSync(child, depth + 1));
}

export function cronHandler(
  work: (request: Request) => Promise<unknown>,
  authorization: CronAuthorization = {},
) {
  return async (request: Request) => {
    const supplied = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
    if (
      !verifySecret(supplied, process.env.CRON_SECRET) &&
      !(authorization.liveSecret && verifySecret(supplied, process.env.LIVE_SYNC_SECRET)) &&
      !(authorization.githubOidc && (await verifyGithubActionsOidc(supplied)))
    )
      return Response.json({ error: 'Non autorisé' }, { status: 401, headers });
    try {
      const result = await work(request);
      return Response.json(result, { status: incompleteSync(result) ? 503 : 200, headers });
    } catch (error) {
      const code =
        error instanceof Error && /^[A-Z][A-Z0-9_]{1,63}$/.test(error.message)
          ? error.message
          : 'UNEXPECTED_ERROR';
      log('FOOTBALL_CRON_FAILED', { code });
      return Response.json(
        { error: 'Synchronisation indisponible. Consultez le journal.' },
        { status: 503, headers },
      );
    }
  };
}
