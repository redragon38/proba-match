import { describe, expect, it } from 'vitest';
import { monitoredRoute, recordTiming, telemetrySnapshot } from '@/services/telemetry';
import { MemoryCache } from '@/services/cache';
describe('Bounded operational diagnostics', () => {
  it('counts cache hits, coalescing and failed loads without publishing cached values', async () => {
    const cache = new MemoryCache();
    await Promise.all(
      Array.from({ length: 3 }, () =>
        cache.get('secret-key', async () => ({ secret: 'private' }), 1000),
      ),
    );
    await cache.get('secret-key', async () => null, 1000);
    await expect(
      cache.get(
        'failure',
        async () => {
          throw Error('offline');
        },
        1000,
      ),
    ).rejects.toThrow();
    expect(cache.stats()).toMatchObject({
      requests: 5,
      hits: 1,
      coalesced: 2,
      loads: 2,
      failures: 1,
    });
    expect(JSON.stringify(cache.stats())).not.toContain('private');
  });
  it('returns a controlled unavailable response and records slow and failed calls', async () => {
    const response = await monitoredRoute('/api/test', async () => {
      throw Error('postgres://private');
    })(new Request('http://localhost/api/test'));
    expect(response.status).toBe(503);
    expect(response.headers.get('server-timing')).toMatch(/^app;dur=/);
    expect(await response.text()).not.toContain('private');
    recordTiming('prediction:test', 1500);
    expect(telemetrySnapshot().operations['/api/test'].errors).toBe(1);
    expect(telemetrySnapshot().operations['prediction:test'].p95Ms).toBe(1500);
  });
});
