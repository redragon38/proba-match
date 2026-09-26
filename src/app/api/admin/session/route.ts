import { cookies } from 'next/headers';
import { sameOrigin, verifySecret, createAdminSession } from '@/lib/auth';
import { allowAdminAttempt } from '@/services/admin-throttle';
import { readJsonBody } from '@/lib/request-body';
import { z } from 'zod';
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: 'Origine refusée' }, { status: 403 });
  try {
    if (!(await allowAdminAttempt(request)))
      return Response.json(
        { error: 'Trop de tentatives. Réessayez dans dix minutes.' },
        { status: 429, headers: { 'Retry-After': '600' } },
      );
  } catch {
    return Response.json({ error: 'Vérification temporairement indisponible.' }, { status: 503 });
  }
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const parsed = z
    .object({ secret: z.string().min(1).max(512) })
    .strict()
    .safeParse(body.value);
  if (!parsed.success) return Response.json({ error: 'Requête invalide' }, { status: 400 });
  if (!verifySecret(parsed.data.secret, process.env.ADMIN_SECRET))
    return Response.json(
      { error: 'Accès refusé ou administration non configurée.' },
      { status: 401 },
    );
  const jar = await cookies();
  jar.set('ms-admin', createAdminSession(process.env.ADMIN_SECRET!), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 8 * 3600,
  });
  return Response.json({ ok: true });
}
export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: 'Origine refusée' }, { status: 403 });
  (await cookies()).delete('ms-admin');
  return Response.json({ ok: true });
}
