import { cronHandler } from '@/services/football/cron';
import { syncOpenFootball } from '@/services/football/openfootball-sync';
import { syncSecondary } from '@/services/football/secondary';

function parisDate(offsetDays: number) {
  const base = new Date();
  base.setUTCDate(base.getUTCDate() + offsetDays);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(base);
}

export const GET = cronHandler(async () => {
  const dates = Array.from({ length: 9 }, (_, index) => parisDate(index - 7));
  const openfootball = await syncOpenFootball({ force: true });
  const secondary = [];

  for (const date of dates) {
    secondary.push({ date, result: await syncSecondary({ date, enrich: true, forceWindow: true }) });
  }

  return {
    status: 'success',
    window: { from: dates[0], to: dates[dates.length - 1], timezone: 'Europe/Paris' },
    openfootball,
    secondary,
  };
});
