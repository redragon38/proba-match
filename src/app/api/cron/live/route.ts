import { cronHandler } from '@/services/football/cron';
import { syncSecondary } from '@/services/football/secondary';
export const maxDuration = 300;
export const GET = cronHandler(() => syncSecondary({ enrich: true }));
