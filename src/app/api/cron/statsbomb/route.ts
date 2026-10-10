import { cronHandler } from '@/services/football/cron';
import { syncStatsbombAdvancedDetails } from '@/services/football/statsbomb-sync';

export const maxDuration = 300;

export const GET = cronHandler(async (request) => {
  const raw = new URL(request.url).searchParams.get('limit') ?? '3';
  if (!/^\d+$/.test(raw)) throw new Error('INVALID_BATCH_LIMIT');
  const limit = Number(raw);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 10)
    throw new Error('INVALID_BATCH_LIMIT');
  return syncStatsbombAdvancedDetails(limit);
});
