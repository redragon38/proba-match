import { cronHandler } from '@/services/football/cron';
import { syncSportsDbPlayers } from '@/services/football/sportsdb-sync';

export const maxDuration = 300;
export const GET = cronHandler(() => syncSportsDbPlayers());
