import { cronHandler } from '@/services/football/cron';
import { syncSportsDbPlayers } from '@/services/football/sportsdb-sync';

import { syncExpandedPlayers } from '@/services/football/espn-sync';
export const maxDuration = 300;
export const GET = cronHandler(async () => ({
  expanded: await syncExpandedPlayers(),
  sportsdb: await syncSportsDbPlayers(),
}));
