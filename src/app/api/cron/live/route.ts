import { cronHandler } from '@/services/football/cron';
import { syncSecondary } from '@/services/football/secondary';
import { syncExpandedMatchDetails } from '@/services/football/espn-sync';
import { syncFotmobAdvancedDetails } from '@/services/football/fotmob-sync';
import { syncStatsbombAdvancedDetails } from '@/services/football/statsbomb-sync';
import { syncFotmobLive } from '@/services/football/fotmob-live-sync';
export const maxDuration = 300;
export const GET = cronHandler(async () => ({
  realtime: await syncFotmobLive(),
  espn: await syncExpandedMatchDetails(3),
  fotmob: await syncFotmobAdvancedDetails(3),
  statsbomb: await syncStatsbombAdvancedDetails(3),
  secondary: await syncSecondary({ enrich: true }),
}));
