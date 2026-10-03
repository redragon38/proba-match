import { cookies } from 'next/headers';
import { sameOrigin, verifyAdminSession } from '@/lib/auth';
import { syncFootball } from '@/services/football/sync';
import { syncExpandedFootball, syncExpandedPlayers } from '@/services/football/espn-sync';
import { syncOpenFootball } from '@/services/football/openfootball-sync';
import { readJsonBody } from '@/lib/request-body';
import { z } from 'zod';
export const maxDuration = 300;
const syncRequest = z
  .object({
    provider: z.enum(['openfootball', 'api-football', 'espn', 'espn-players']).optional(),
    date: z.iso.date().optional(),
    history: z.boolean().optional(),
    enrich: z.boolean().optional(),
  })
  .strict();
export async function POST(request: Request) {
  if (!sameOrigin(request) || !verifyAdminSession((await cookies()).get('ms-admin')?.value))
    return Response.json({ error: 'Non autorisé' }, { status: 401 });
  const input = await readJsonBody(request);
  if (!input.ok) return input.response;
  const parsed = syncRequest.safeParse(input.value);
  if (!parsed.success)
    return Response.json({ error: 'Paramètres de synchronisation invalides' }, { status: 400 });
  try {
    const body = parsed.data;
    if (body.provider === 'espn')
      return Response.json(await syncExpandedFootball({ history: body.history === true }));
    if (body.provider === 'espn-players') return Response.json(await syncExpandedPlayers());
    if (body.provider === 'openfootball')
      return Response.json(await syncOpenFootball({ history: body.history === true }));
    return Response.json(await syncFootball({ date: body.date, enrich: body.enrich === true }));
  } catch {
    return Response.json({ error: 'Échec de synchronisation ; voir le journal.' }, { status: 503 });
  }
}
