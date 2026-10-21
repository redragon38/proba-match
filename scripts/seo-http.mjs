import { setTimeout as pause } from 'node:timers/promises';
const timings = new WeakMap();
export const seoRequestTiming = (response) => timings.get(response);

/** One paced request at a time by default; no unbounded retries on an unhealthy site. */
export async function seoFetch(url, options = {}, policy = {}) {
  const delay = policy.delay ?? 300;
  const timeout = policy.timeout ?? 30000;
  const retries = policy.retries ?? 2;
  const fetcher = policy.fetcher ?? fetch;
  for (let attempt = 0; ; attempt++) {
    await pause(delay * (attempt + 1));
    try {
      const startedAt = performance.now();
      const response = await fetcher(url, { ...options, signal: AbortSignal.timeout(timeout) });
      timings.set(response, { startedAt, ttfbMs: Math.round(performance.now() - startedAt) });
      if (![408, 429, 500, 502, 503, 504].includes(response.status) || attempt >= retries)
        return response;
      await response.body?.cancel();
    } catch (error) {
      if (attempt >= retries) throw error;
    }
  }
}
