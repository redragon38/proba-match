import { cronHandler } from '@/services/football/cron';
import { syncOpenFootball } from '@/services/football/openfootball-sync';
import { syncExpandedFootball } from '@/services/football/espn-sync';
export const maxDuration = 300;
export const GET = cronHandler(async () => ({
  openfootball: await syncOpenFootball(),
  expanded: await syncExpandedFootball(),
}));
