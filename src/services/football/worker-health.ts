import { z } from 'zod';
const heartbeatSchema = z.object({
  checkedAt: z.iso.datetime(),
  nextOpen: z.iso.datetime(),
  secondaryStatus: z.string(),
  openStatus: z.string().optional(),
  cycle: z.number().optional(),
});
export function workerHealth(
  payload: unknown,
  now = Date.now(),
): {
  state: 'unknown' | 'active' | 'late';
  checkedAt?: string;
  nextOpen?: string;
  secondaryStatus?: string;
  openStatus?: string;
  cycle?: number;
  status: 'RUNNING' | 'DEGRADED' | 'STOPPED';
} {
  const parsed = heartbeatSchema.safeParse(payload);
  if (!parsed.success) return { state: 'unknown' as const, status: 'STOPPED' };
  const age = now - Date.parse(parsed.data.checkedAt);
  const active = age >= 0 && age <= 120000;
  const degraded =
    ['partial', 'failed'].includes(parsed.data.openStatus ?? '') ||
    ['partial', 'failed'].includes(parsed.data.secondaryStatus) ||
    (parsed.data.openStatus !== 'running' && now - Date.parse(parsed.data.nextOpen) > 120000);
  return {
    ...parsed.data,
    state: age >= 0 && age <= 120000 ? ('active' as const) : ('late' as const),
    status: !active ? 'STOPPED' : degraded ? 'DEGRADED' : 'RUNNING',
  };
}
