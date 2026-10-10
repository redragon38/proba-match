import { cronHandler } from '@/services/football/cron';
import { syncFotmobAdvancedDetails } from '@/services/football/fotmob-sync';

export const maxDuration = 300;

export const GET = cronHandler(async (request) => {
  const raw = new URL(request.url).searchParams.get('limit') ?? '3';
  if (!/^\d+$/.test(raw)) throw new Error('INVALID_BATCH_LIMIT');
  return syncFotmobAdvancedDetails(Number(raw));
});
