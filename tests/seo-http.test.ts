import { describe, expect, it, vi } from 'vitest';
import { seoFetch } from '../scripts/seo-http.mjs';

describe('paced SEO requests', () => {
  it('retries temporary failure but does not hide a persistent HTTP error', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('', { status: 503 }));
    const response = await seoFetch('https://example.test', {}, { fetcher, delay: 0, retries: 2 });
    expect(response.status).toBe(503);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it('never retries a genuine missing page', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('', { status: 404 }));
    expect((await seoFetch('https://example.test', {}, { fetcher, delay: 0 })).status).toBe(404);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('rethrows exhausted network errors', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('offline'));
    await expect(
      seoFetch('https://example.test', {}, { fetcher, delay: 0, retries: 1 }),
    ).rejects.toThrow('offline');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
