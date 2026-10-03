import { log } from '@/lib/logger';
type Sample = { at: number; ms: number; failed: boolean };
const samples = new Map<string, Sample[]>();
/** Bounded rolling diagnostics for this process, not an assertion about all Vercel instances. */
export function recordTiming(operation: string, ms: number, failed = false) {
  if (!Number.isFinite(ms) || ms < 0 || !/^[a-zA-Z0-9_:/[\]-]{1,80}$/.test(operation)) return;
  if (!samples.has(operation) && samples.size >= 32) return;
  const recent = (samples.get(operation) ?? []).filter((s) => Date.now() - s.at < 900000);
  recent.push({ at: Date.now(), ms: Math.round(ms * 100) / 100, failed });
  samples.set(operation, recent.slice(-200));
  if (failed || ms > 1000)
    log('OPERATION_THRESHOLD', {
      code: operation,
      durationMs: Math.round(ms),
      count: failed ? 1 : 0,
    });
}
export async function timed<T>(operation: string, work: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    const result = await work();
    recordTiming(operation, performance.now() - start);
    return result;
  } catch (error) {
    recordTiming(operation, performance.now() - start, true);
    throw error;
  }
}
export function telemetrySnapshot() {
  return {
    scope: 'current_process_last_15_minutes_max_200_samples',
    operations: Object.fromEntries(
      [...samples].map(([key, rows]) => {
        const recent = rows.filter((s) => Date.now() - s.at < 900000);
        const sorted = recent.map((s) => s.ms).sort((a, b) => a - b);
        const percentile = (q: number) =>
          sorted[Math.max(0, Math.ceil(sorted.length * q) - 1)] ?? null;
        return [
          key,
          {
            count: recent.length,
            errors: recent.filter((s) => s.failed).length,
            p50Ms: percentile(0.5),
            p95Ms: percentile(0.95),
          },
        ];
      }),
    ),
  };
}
export function monitoredRoute(
  operation: string,
  handler: (request: Request) => Promise<Response>,
) {
  return async (request: Request) => {
    const start = performance.now();
    let response: Response;
    try {
      response = await handler(request);
    } catch {
      response = Response.json({ error: 'Service temporairement indisponible' }, { status: 503 });
    }
    const ms = performance.now() - start;
    recordTiming(operation, ms, response.status >= 500);
    response.headers.set('Server-Timing', `app;dur=${ms.toFixed(2)}`);
    return response;
  };
}
