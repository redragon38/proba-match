import { cronHandler } from '@/services/football/cron';
import { syncSecondary } from '@/services/football/secondary';

export const maxDuration = 300;

/** Bounded secondary-provider enrichment for one matchday. */
export const GET = cronHandler(async (request) => {
  const date = new URL(request.url).searchParams.get('date');
  if (
    !date ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(Date.parse(`${date}T00:00:00Z`))
  )
    throw new Error('INVALID_DATE');
  return syncSecondary({ date, forceWindow: true });
});
