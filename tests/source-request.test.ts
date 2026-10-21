import { describe, expect, it, vi } from 'vitest';
import { requestFootballSource } from '@/services/football/source-request';

describe('public football source retries', () => {
  it('recovers from a temporary failure with bounded backoff', async () => {
    const transport = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));
    const wait = vi.fn().mockResolvedValue(undefined);
    const attempt = vi.fn();
    expect(
      (
        await requestFootballSource(
          transport,
          'https://example.test',
          {},
          { wait, onAttempt: attempt },
        )
      ).status,
    ).toBe(200);
    expect(wait).toHaveBeenCalledWith(1000);
    expect(attempt).toHaveBeenCalledTimes(2);
  });
  it('respects provider cooldown instead of retrying early', async () => {
    const transport = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 429, headers: { 'Retry-After': '120' } }));
    const wait = vi.fn();
    expect(
      (await requestFootballSource(transport, 'https://example.test', {}, { wait })).status,
    ).toBe(429);
    expect(transport).toHaveBeenCalledOnce();
    expect(wait).not.toHaveBeenCalled();
  });
  it('does not retry permanent errors or exceed its retry budget', async () => {
    const wait = vi.fn().mockResolvedValue(undefined);
    const denied = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
    expect((await requestFootballSource(denied, 'https://example.test', {}, { wait })).status).toBe(
      401,
    );
    expect(denied).toHaveBeenCalledOnce();
    const offline = vi.fn().mockRejectedValue(new Error('offline'));
    await expect(
      requestFootballSource(offline, 'https://example.test', {}, { wait }),
    ).rejects.toThrow('offline');
    expect(offline).toHaveBeenCalledTimes(3);
    expect(wait.mock.calls.map(([delay]) => delay)).toEqual([1000, 2000]);
  });
});
