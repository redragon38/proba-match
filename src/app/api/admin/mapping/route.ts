import { cookies } from 'next/headers';
import { z } from 'zod';
import { sameOrigin, verifyAdminSession } from '@/lib/auth';
import { db } from '@/database/client';
import { bindIdentity } from '@/services/football/identities';
import { readJsonBody } from '@/lib/request-body';
export async function POST(request: Request) {
  if (!sameOrigin(request) || !verifyAdminSession((await cookies()).get('ms-admin')?.value))
    return Response.json({ error: 'Non autorisé' }, { status: 401 });
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const parsed = z
    .object({ issueId: z.string().min(1).max(500), entityId: z.string().min(1).max(100) })
    .strict()
    .safeParse(body.value);
  if (!parsed.success) return Response.json({ error: 'Mapping invalide' }, { status: 400 });
  const issue = await db.mappingIssue.findUnique({ where: { id: parsed.data.issueId } });
  if (!issue || issue.resolvedAt)
    return Response.json({ error: 'Cas introuvable ou résolu' }, { status: 404 });
  const id = parsed.data.entityId;
  const found =
    issue.kind === 'team'
      ? await db.team.findUnique({ where: { id } })
      : issue.kind === 'match'
        ? await db.match.findUnique({ where: { id } })
        : issue.kind === 'competition'
          ? await db.competition.findUnique({ where: { id } })
          : issue.kind === 'player'
            ? await db.player.findUnique({ where: { id } })
            : null;
  if (!found) return Response.json({ error: 'Identifiant interne introuvable' }, { status: 400 });
  try {
    await bindIdentity(
      issue.provider,
      issue.kind as 'team' | 'match' | 'competition' | 'player',
      issue.externalId,
      id,
      issue.externalName,
    );
    await db.mappingIssue.update({ where: { id: issue.id }, data: { resolvedAt: new Date() } });
    return Response.json({ status: 'confirmed' });
  } catch {
    return Response.json({ error: 'Identifiant déjà associé à une autre entité' }, { status: 409 });
  }
}
