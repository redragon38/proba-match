import { cronHandler } from '@/services/football/cron';
import { syncExpandedPlayers } from '@/services/football/espn-sync';

export const maxDuration = 300;

export const GET = cronHandler(async (request) => {
  const value = Number(new URL(request.url).searchParams.get('limit') ?? '3');
  if (!Number.isInteger(value) || value < 1 || value > 10) throw new Error('INVALID_BATCH_LIMIT');
  return syncExpandedPlayers(value);
});
