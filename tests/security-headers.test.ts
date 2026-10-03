import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import config from '../next.config';

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://proba-match.vercel.app');
  vi.stubEnv('VERCEL_ENV', 'production');
  vi.stubEnv('APP_ENV', 'production');
});
afterEach(() => vi.unstubAllEnvs());
const globalHeaders = async () =>
  (await config.headers!()).find((rule) => rule.source === '/(.*)')!.headers;
describe('Security and canonical host configuration', () => {
  it('restricts frames, objects, forms and base URLs while preserving Next scripts', async () => {
    const headers = await globalHeaders();
    const csp = headers.find((header) => header.key === 'Content-Security-Policy')!.value;
    for (const directive of [
      "object-src 'none'",
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self'",
      "connect-src 'self'",
      "font-src 'self'",
      "frame-src 'none'",
      'upgrade-insecure-requests',
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ])
      expect(csp).toContain(directive);
    expect(csp).not.toContain('unsafe-eval');
    expect(headers).toContainEqual({ key: 'X-Content-Type-Options', value: 'nosniff' });
    expect(headers).toContainEqual({ key: 'X-Frame-Options', value: 'DENY' });
    expect(headers).toContainEqual({ key: 'Strict-Transport-Security', value: 'max-age=31536000' });
  });
  it('adds global noindex to preview without blocking production', async () => {
    expect((await globalHeaders()).some((header) => header.key === 'X-Robots-Tag')).toBe(false);
    vi.stubEnv('VERCEL_ENV', 'preview');
    expect(
      (await globalHeaders()).find((h) => h.key === 'Content-Security-Policy')!.value,
    ).not.toContain('upgrade-insecure-requests');
    expect(await globalHeaders()).toContainEqual({
      key: 'X-Robots-Tag',
      value: 'noindex, nofollow',
    });
  });
  it('does not advertise HTTPS-only transport on a localhost HTTP configuration', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000');
    expect(
      (await globalHeaders()).some((header) => header.key === 'Strict-Transport-Security'),
    ).toBe(false);
  });
  it('permanently redirects only the www hostname directly to its HTTPS canonical host', async () => {
    expect(await config.redirects!()).toContainEqual({
      source: '/:path*',
      has: [{ type: 'host', value: 'www.probamatch.com' }],
      destination: 'https://proba-match.vercel.app/:path*',
      permanent: true,
    });
  });
});
