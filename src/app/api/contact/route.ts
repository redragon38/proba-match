import { createHmac } from 'node:crypto';
import { z } from 'zod';
import { db } from '@/database/client';
import { readJsonBody } from '@/lib/request-body';
import { WindowLimiter } from '@/lib/rate-limit';
import { siteOrigin } from '@/lib/seo';

export const runtime = 'nodejs';

const input = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.email().max(160),
  reason: z.enum([
    'Question générale',
    'Signaler une donnée incorrecte',
    'Proposer une amélioration',
    'Proposition de collaboration',
    'Autre demande',
  ]),
  subject: z.string().trim().min(3).max(120),
  message: z.string().trim().min(10).max(3000),
  website: z.string().max(200).optional(),
}).strict();

const localLimit = new WindowLimiter(3, 60 * 60 * 1000);
const localGlobalLimit = new WindowLimiter(30, 60 * 60 * 1000);
const headers = { 'Cache-Control': 'no-store' };

async function allowBucket(bucket: string, limit: number, local: WindowLimiter) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !process.env.DATABASE_URL) return local.take(bucket);
  const key = 'contact-rate:' + createHmac('sha256', secret).update(bucket).digest('hex');
  const until = new Date(Date.now() + 60 * 60 * 1000);
  const rows = await db.$queryRaw<{ payload: { count: number } }[]>`
    INSERT INTO "CacheEntry" ("key", "payload", "expiresAt", "staleUntil", "updatedAt")
    VALUES (${key}, '{"count":1}'::jsonb, ${until}, ${until}, NOW())
    ON CONFLICT ("key") DO UPDATE SET
      "payload" = jsonb_build_object('count', CASE WHEN "CacheEntry"."expiresAt" < NOW()
        THEN 1 ELSE ("CacheEntry"."payload"->>'count')::int + 1 END),
      "expiresAt" = CASE WHEN "CacheEntry"."expiresAt" < NOW() THEN ${until}
        ELSE "CacheEntry"."expiresAt" END,
      "updatedAt" = NOW()
    RETURNING "payload"`;
  return rows[0].payload.count <= limit;
}

async function allowContact(email: string) {
  if (!(await allowBucket('global', 30, localGlobalLimit))) return false;
  return allowBucket(`email:${email.toLowerCase()}`, 3, localLimit);
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin || (origin !== new URL(request.url).origin && origin !== siteOrigin()))
    return Response.json({ error: 'Origine invalide.' }, { status: 403, headers });

  const body = await readJsonBody(request, 8192);
  if (!body.ok) return body.response;
  const parsed = input.safeParse(body.value);
  if (!parsed.success)
    return Response.json({ error: 'Vérifiez les champs du formulaire.' }, { status: 400, headers });
  if (parsed.data.website)
    return Response.json({ ok: true }, { headers });

  const formId = process.env.FORMSPREE_FORM_ID?.trim() || 'xaeqaazb';
  if (!formId || !/^[a-zA-Z0-9]{6,32}$/.test(formId))
    return Response.json({ error: 'Envoi temporairement indisponible.' }, { status: 503, headers });

  try {
    if (!(await allowContact(parsed.data.email)))
      return Response.json(
        { error: 'Trop de messages envoyés. Réessayez dans une heure.' },
        { status: 429, headers: { ...headers, 'Retry-After': '3600' } },
      );

    const { name, email, reason, subject, message } = parsed.data;
    const delivery = await fetch(`https://formspree.io/f/${formId}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        Origin: origin,
        Referer: `${origin}/contact`,
        'User-Agent': 'Mozilla/5.0',
      },
      body: new URLSearchParams({ name, email, reason, subject, message, _subject: `[${reason}] ${subject}` }),
      signal: AbortSignal.timeout(12000),
    });
    if (!delivery.ok) {
      console.error('Contact delivery rejected', delivery.status);
      return Response.json(
        { error: 'Le message n’a pas pu être envoyé. Réessayez plus tard.' },
        { status: 502, headers },
      );
    }
    return Response.json({ ok: true }, { headers });
  } catch (error) {
    console.error('Contact delivery failed', error instanceof Error ? error.name : 'unknown');
    return Response.json(
      { error: 'Le message n’a pas pu être envoyé. Réessayez plus tard.' },
      { status: 503, headers },
    );
  }
}
