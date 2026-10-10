import { cronHandler } from '@/services/football/cron';
import { syncFotmobLive } from '@/services/football/fotmob-live-sync';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export const GET = cronHandler(() => syncFotmobLive(), {
  liveSecret: true,
  githubOidc: true,
});
