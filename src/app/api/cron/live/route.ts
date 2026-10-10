import { cronHandler } from '@/services/football/cron';
import { syncSecondary } from '@/services/football/secondary';
import { syncExpandedMatchDetails } from '@/services/football/espn-sync';
import { syncFotmobAdvancedDetails } from '@/services/football/fotmob-sync';
export const maxDuration = 300;
export const GET = cronHandler(async () => ({
  espn: await syncExpandedMatchDetails(3),
  fotmob: await syncFotmobAdvancedDetails(3),
  secondary: await syncSecondary({ enrich: true }),
}));
