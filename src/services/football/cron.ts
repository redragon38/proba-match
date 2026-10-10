import { verifySecret } from '@/lib/auth';
import { verifyGithubActionsOidc } from '@/services/github-oidc';
type CronAuthorization = { liveSecret?: boolean; githubOidc?: boolean };

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
      return Response.json({ error: 'Non autorisé' }, { status: 401 });
    try {
      return Response.json(await work(request));
    } catch {
      return Response.json(
        { error: 'Synchronisation indisponible. Consultez le journal.' },
        { status: 503 },
      );
    }
  };
}
