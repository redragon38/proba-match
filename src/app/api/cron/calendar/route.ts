import { cronHandler } from '@/services/football/cron';
import { syncOpenFootball } from '@/services/football/openfootball-sync';

export const maxDuration = 180;
export const dynamic = 'force-dynamic';
export const GET = cronHandler(() => syncOpenFootball({ force: true }));
