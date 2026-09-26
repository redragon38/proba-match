import { cronHandler } from '@/services/football/cron';
import { syncOpenFootball } from '@/services/football/openfootball-sync';
export const maxDuration = 300;
export const GET = cronHandler(() => syncOpenFootball());
