import { cronHandler } from '@/services/football/cron';
import { syncOpenFootball } from '@/services/football/openfootball-sync';
import { syncSecondary } from '@/services/football/secondary';
import { syncFotmobLive } from '@/services/football/fotmob-live-sync';
import { calendarDateOffset } from '@/lib/calendar-date';

export const maxDuration = 300;

export const GET = cronHandler(async () => {
  const now = new Date();
  const dates = Array.from({ length: 9 }, (_, index) => calendarDateOffset(now, index - 7));
  const openfootball = await syncOpenFootball({ force: true });
  const catchup = await syncFotmobLive(now, { catchUp: true });
  const secondary = [];

  for (const date of dates) {
    secondary.push({ date, result: await syncSecondary({ date, forceWindow: true }) });
  }

  return {
    status:
      openfootball.status === 'success' &&
      catchup.status === 'success' &&
      secondary.every((row) => ['success', 'disabled'].includes(row.result.status))
        ? 'success'
        : 'partial',
    window: { from: dates[0], to: dates[dates.length - 1], timezone: 'Europe/Paris' },
    openfootball,
    catchup,
    secondary,
  };
});
