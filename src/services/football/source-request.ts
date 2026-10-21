import { setTimeout as pause } from 'node:timers/promises';

type RetryPolicy = {
  retries?: number;
  wait?: (ms: number) => Promise<unknown>;
  onAttempt?: () => void;
};

/** Public sources only. Paid/quota-accounted providers keep their existing reservation logic. */
export async function requestFootballSource(
  transport: typeof fetch,
  url: string,
  init: RequestInit = {},
  policy: RetryPolicy = {},
) {
  const wait = policy.wait ?? pause;
  for (let attempt = 0; ; attempt++) {
    let response: Response;
    try {
      policy.onAttempt?.();
      response = await transport(url, { ...init, signal: AbortSignal.timeout(30000) });
    } catch (error) {
      if (attempt >= (policy.retries ?? 2)) throw error;
      await wait(1000 * 2 ** attempt);
      continue;
    }
    if (
      ![408, 429, 500, 502, 503, 504].includes(response.status) ||
      attempt >= (policy.retries ?? 2)
    )
      return response;
    const retryAfter = response.headers.get('retry-after');
    const seconds = retryAfter && /^\d+$/.test(retryAfter) ? Number(retryAfter) * 1000 : null;
    const requestedDelay = retryAfter ? (seconds ?? Date.parse(retryAfter) - Date.now()) : 0;
    // Never retry earlier than the provider asks; a long cooldown belongs to the next job.
    if (requestedDelay > 30000) return response;
    const delay = Math.max(
      1000 * 2 ** attempt,
      Number.isFinite(requestedDelay) ? requestedDelay : 0,
    );
    await response.body?.cancel();
    await wait(delay);
  }
}
