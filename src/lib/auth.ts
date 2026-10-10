import { createHmac, timingSafeEqual } from 'node:crypto';
const safeEqual = (a: string, b: string) => {
  const aa = Buffer.from(a),
    bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
};
export function verifySecret(input: string, secret: string | undefined) {
  return !!secret && secret.length >= 32 && safeEqual(input, secret);
}
export function createAdminSession(secret: string, now = Date.now()) {
  const exp = String(now + 8 * 3600_000);
  return `${exp}.${createHmac('sha256', secret).update(`admin:${exp}`).digest('hex')}`;
}
export function verifyAdminSession(
  token: string | undefined,
  secret = process.env.ADMIN_SECRET,
  now = Date.now(),
) {
  if (!token || !secret || secret.length < 32) return false;
  const match = /^(\d{1,16})\.([a-f0-9]{64})$/.exec(token);
  if (!match) return false;
  const [, exp, sig] = match;
  if (!Number.isSafeInteger(Number(exp)) || Number(exp) <= now || Number(exp) > now + 8 * 3600_000)
    return false;
  return safeEqual(sig, createHmac('sha256', secret).update(`admin:${exp}`).digest('hex'));
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin || origin === 'null') return false;
  try {
    const configured = process.env.NEXT_PUBLIC_SITE_URL;
    if (configured) return origin === new URL(configured).origin;
    // Local development has no public origin; production fails closed when it is missing.
    return process.env.NODE_ENV !== 'production' && origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
