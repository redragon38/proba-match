import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const allow = vi.hoisted(() => vi.fn());
vi.mock('@/services/vitals-limit', () => ({ allowVitalsReport: allow }));
import { POST } from '@/app/api/vitals/route';
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_WEB_VITALS_ENABLED', 'true');
  allow.mockResolvedValue(true);
});
afterEach(() => vi.unstubAllEnvs());
const request = (data: unknown, origin = 'http://localhost') =>
  new Request('http://localhost/api/vitals', {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify(data),
  });
it('does not collect measurements unless explicitly enabled', async () => {
  vi.stubEnv('NEXT_PUBLIC_WEB_VITALS_ENABLED', 'false');
  expect((await POST(request({ name: 'LCP', value: 12 }))).status).toBe(404);
});
it('rejects cross-origin and identifiable extra fields', async () => {
  expect((await POST(request({ name: 'LCP', value: 12 }, 'https://attacker.invalid'))).status).toBe(
    403,
  );
  expect((await POST(request({ name: 'LCP', value: 12, userId: 'private' }))).status).toBe(400);
});
it('validates metric names, numbers and body bounds', async () => {
  for (const data of [
    { name: 'unknown', value: 1 },
    { name: 'CLS', value: -1 },
    { name: 'LCP', value: 4000000 },
    { name: 'LCP', value: 1, query: 'x'.repeat(2000) },
  ])
    expect([400, 413]).toContain((await POST(request(data))).status);
});
it('uses the shared limiter and fails closed if its store is unavailable', async () => {
  allow.mockResolvedValue(false);
  expect((await POST(request({ name: 'CLS', value: 0.01 }))).status).toBe(429);
  allow.mockRejectedValue(new Error('secret database credentials'));
  expect((await POST(request({ name: 'LCP', value: 100 }))).status).toBe(503);
});
it('logs only the whitelisted measurement', async () => {
  const log = vi.spyOn(console, 'info').mockImplementation(() => {});
  expect((await POST(request({ name: 'INP', value: 123 }))).status).toBe(204);
  const data = JSON.parse(log.mock.calls[0][0]);
  expect(Object.keys(data).sort()).toEqual(['at', 'event', 'name', 'value']);
  log.mockRestore();
});
