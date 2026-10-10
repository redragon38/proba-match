import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAdminSession, verifyAdminSession, verifySecret, sameOrigin } from '@/lib/auth';
describe('Administration', () => {
  afterEach(() => vi.unstubAllEnvs());
  const secret = 'test-only-secret-with-at-least-32-characters';
  it('refuse une configuration absente ou trop courte', () => {
    expect(verifySecret('', undefined)).toBe(false);
    expect(verifySecret('short', 'short')).toBe(false);
    expect(verifySecret(secret, secret)).toBe(true);
  });
  it('valide la signature et la durée, refuse les falsifications', () => {
    const token = createAdminSession(secret, 1000);
    expect(verifyAdminSession(token, secret, 1001)).toBe(true);
    expect(verifyAdminSession(token, secret, 9 * 3600_000)).toBe(false);
    expect(verifyAdminSession(token + 'a', secret, 1001)).toBe(false);
    expect(verifyAdminSession(token + '.extra', secret, 1001)).toBe(false);
    expect(verifyAdminSession(token, secret, 1000 + 8 * 3600_000)).toBe(false);
    expect(verifyAdminSession(token, 'other-secret-at-least-32-characters', 1001)).toBe(false);
  });
  it('refuse un POST depuis une origine externe', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000');
    expect(
      sameOrigin(
        new Request('http://localhost:3000/api/admin/sync', {
          headers: { origin: 'https://attacker.example' },
        }),
      ),
    ).toBe(false);
    expect(
      sameOrigin(
        new Request('http://localhost:3000/api/admin/sync', {
          headers: { origin: 'http://localhost:3000' },
        }),
      ),
    ).toBe(true);
  });
  it('échoue proprement avec une origine absente, opaque ou une configuration invalide', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'not-a-url');
    for (const origin of ['', 'null', 'https://attacker.example'])
      expect(
        sameOrigin(new Request('http://localhost:3000/api/admin/session', { headers: { origin } })),
      ).toBe(false);
  });
  it('échoue fermé en production lorsque l’origine publique manque', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    expect(
      sameOrigin(
        new Request('https://example.test/api/admin/session', {
          headers: { origin: 'https://example.test' },
        }),
      ),
    ).toBe(false);
  });
});
