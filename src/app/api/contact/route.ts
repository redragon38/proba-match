import { createHmac } from 'node:crypto';
import nodemailer from 'nodemailer';
import { z } from 'zod';
import { db } from '@/database/client';
import { readJsonBody } from '@/lib/request-body';
import { WindowLimiter } from '@/lib/rate-limit';
import { legalConfig } from '@/lib/legal';

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
  if (!origin || origin !== new URL(request.url).origin)
    return Response.json({ error: 'Origine invalide.' }, { status: 403, headers });

  const body = await readJsonBody(request, 8192);
  if (!body.ok) return body.response;
  const parsed = input.safeParse(body.value);
  if (!parsed.success)
    return Response.json({ error: 'Vérifiez les champs du formulaire.' }, { status: 400, headers });
  if (parsed.data.website)
    return Response.json({ ok: true }, { headers });

  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_APP_PASSWORD;
  const recipient = legalConfig().contact;
  if (!user || !password || !recipient)
    return Response.json({ error: 'Envoi temporairement indisponible.' }, { status: 503, headers });

  try {
    if (!(await allowContact(parsed.data.email)))
      return Response.json(
        { error: 'Trop de messages envoyés. Réessayez dans une heure.' },
        { status: 429, headers: { ...headers, 'Retry-After': '3600' } },
      );

    const transport = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user, pass: password },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
    const { name, email, reason, subject, message } = parsed.data;
    await transport.sendMail({
      from: { name: 'Proba Match — Contact', address: user },
      to: recipient,
      replyTo: { name, address: email },
      subject: `[${reason}] ${subject}`,
      text: `Nom : ${name}\nE-mail : ${email}\nMotif : ${reason}\n\n${message}`,
    });
    return Response.json({ ok: true }, { headers });
  } catch (error) {
    console.error('Contact delivery failed', error instanceof Error ? error.name : 'unknown');
    return Response.json(
      { error: 'Le message n’a pas pu être envoyé. Réessayez plus tard.' },
      { status: 503, headers },
    );
  }
}
