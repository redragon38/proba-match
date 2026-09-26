import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAdminSession } from '@/lib/auth';

const state = vi.hoisted(() => ({
  token: undefined as string | undefined,
  set: vi.fn(),
  delete: vi.fn(),
  allow: vi.fn(),
  sync: vi.fn(),
  open: vi.fn(),
}));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: () => (state.token ? { value: state.token } : undefined),
    set: state.set,
    delete: state.delete,
  }),
}));
vi.mock('@/services/admin-throttle', () => ({ allowAdminAttempt: state.allow }));
vi.mock('@/services/football/sync', () => ({ syncFootball: state.sync }));
vi.mock('@/services/football/openfootball-sync', () => ({ syncOpenFootball: state.open }));
import { POST as login, DELETE as logout } from '@/app/api/admin/session/route';
import { POST as sync } from '@/app/api/admin/sync/route';
import { cronHandler } from '@/services/football/cron';

const secret = 'test-only-admin-secret-at-least-32-characters';
function request(body: unknown, origin = 'https://example.test') {
  return new Request('https://example.test/api/admin/session', {
    method: 'POST',
    headers: {
      origin,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('ADMIN_SECRET', secret);
  vi.stubEnv('CRON_SECRET', secret);
  vi.stubEnv('NODE_ENV', 'production');
  state.token = undefined;
  state.allow.mockResolvedValue(true);
  state.sync.mockResolvedValue({ status: 'ok' });
  state.open.mockResolvedValue({ status: 'ok' });
});
afterEach(() => vi.unstubAllEnvs());

describe('Admin and cron boundary', () => {
  it('blocks cross-site login/logout before processing credentials', async () => {
    expect((await login(request({ secret }, 'https://attacker.example'))).status).toBe(403);
    expect((await logout(request({}, 'https://attacker.example'))).status).toBe(403);
    expect(state.allow).not.toHaveBeenCalled();
    expect(state.set).not.toHaveBeenCalled();
    expect(state.delete).not.toHaveBeenCalled();
  });
  it('does not expose credentials and sets a secure, HttpOnly, SameSite cookie', async () => {
    const response = await login(request({ secret }));
    expect(response.status).toBe(200);
    expect(await response.text()).not.toContain(secret);
    expect(state.set).toHaveBeenCalledWith('ms-admin', expect.any(String), {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 8 * 3600,
    });
  });
  it('refuses wrong credentials, malformed payloads and excessive request bodies', async () => {
    expect((await login(request({ secret: 'incorrect' }))).status).toBe(401);
    expect((await login(request(null))).status).toBe(400);
    expect((await login(request({ secret, unexpected: true }))).status).toBe(400);
    expect((await login(request({ secret: 'x'.repeat(5000) }))).status).toBe(413);
    expect(state.set).not.toHaveBeenCalled();
  });
  it('fails closed if the login limiter fails and returns Retry-After at its limit', async () => {
    state.allow.mockRejectedValueOnce(new Error('private database details'));
    const failed = await login(request({ secret }));
    expect(failed.status).toBe(503);
    expect(await failed.text()).not.toContain('private database details');
    state.allow.mockResolvedValueOnce(false);
    const limited = await login(request({ secret }));
    expect(limited.status).toBe(429);
    expect(limited.headers.get('Retry-After')).toBe('600');
    expect(state.set).not.toHaveBeenCalled();
  });
  it('requires a valid session and same origin before any synchronization', async () => {
    expect((await sync(request({}))).status).toBe(401);
    state.token = createAdminSession(secret);
    expect((await sync(request({}, 'https://attacker.example'))).status).toBe(401);
    expect(state.sync).not.toHaveBeenCalled();
    expect(state.open).not.toHaveBeenCalled();
  });
  it('validates provider, real calendar date and boolean flags before external work', async () => {
    state.token = createAdminSession(secret);
    for (const body of [
      null,
      { date: '2026-02-30' },
      { date: 123 },
      { provider: 'http://127.0.0.1' },
      { enrich: 'yes' },
    ])
      expect((await sync(request(body))).status).toBe(400);
    expect(state.sync).not.toHaveBeenCalled();
    expect(state.open).not.toHaveBeenCalled();
    expect((await sync(request({ date: '2026-09-20', enrich: true }))).status).toBe(200);
    expect(state.sync).toHaveBeenCalledWith({ date: '2026-09-20', enrich: true });
    expect((await sync(request({ provider: 'openfootball', history: true }))).status).toBe(200);
    expect(state.open).toHaveBeenCalledWith({ history: true });
  });
  it('allows logout only from the site and removes the session', async () => {
    expect((await logout(request({}))).status).toBe(200);
    expect(state.delete).toHaveBeenCalledWith('ms-admin');
  });
  it('does not execute cron work for missing or wrong authorization', async () => {
    const work = vi.fn().mockResolvedValue({ status: 'ok' });
    const handler = cronHandler(work);
    for (const authorization of ['', 'Bearer incorrect'])
      expect(
        (
          await handler(
            new Request('https://example.test/api/cron/live', { headers: { authorization } }),
          )
        ).status,
      ).toBe(401);
    expect(work).not.toHaveBeenCalled();
    expect(
      (
        await handler(
          new Request('https://example.test/api/cron/live', {
            headers: { authorization: `Bearer ${secret}` },
          }),
        )
      ).status,
    ).toBe(200);
    expect(work).toHaveBeenCalledTimes(1);
  });
});
