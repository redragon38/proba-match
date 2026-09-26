import { createHmac } from 'node:crypto';
import { db } from '@/database/client';
import { WindowLimiter } from '@/lib/rate-limit';
const local = new WindowLimiter();
export async function allowAdminAttempt(request: Request) {
  // Only trust the platform-owned address header on Vercel. Other hosts share a global bucket.
  const address =
    process.env.VERCEL === '1'
      ? (request.headers.get('x-vercel-forwarded-for') ?? 'unknown')
      : 'local';
  const key =
    'admin-attempt:' +
    createHmac('sha256', process.env.ADMIN_SECRET ?? 'local-demo')
      .update(address)
      .digest('hex');
  if (!process.env.DATABASE_URL) return local.take(key);
  const until = new Date(Date.now() + 600000);
  const rows = await db.$queryRaw<
    { payload: { count: number } }[]
  >`INSERT INTO "CacheEntry" ("key","payload","expiresAt","staleUntil","updatedAt") VALUES (${key},'{"count":1}'::jsonb,${until},${until},NOW()) ON CONFLICT ("key") DO UPDATE SET "payload"=jsonb_build_object('count', CASE WHEN "CacheEntry"."expiresAt"<NOW() THEN 1 ELSE ("CacheEntry"."payload"->>'count')::int+1 END), "expiresAt"=CASE WHEN "CacheEntry"."expiresAt"<NOW() THEN ${until} ELSE "CacheEntry"."expiresAt" END, "updatedAt"=NOW() RETURNING "payload"`;
  return rows[0].payload.count <= 10;
}
