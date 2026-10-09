import { cronHandler } from '@/services/football/cron';
import { syncExpandedFootball } from '@/services/football/espn-sync';
import { EXPANDED_LEAGUES, type ExpandedLeague } from '@/services/football/providers/espn';

export const maxDuration = 300;

export const GET = cronHandler(async (request?: Request) => {
  const requested = request ? new URL(request.url).searchParams.get('league') : null;
  if (!requested || !(requested in EXPANDED_LEAGUES)) throw new Error('INVALID_LEAGUE');
  return syncExpandedFootball({
    leagues: [requested as ExpandedLeague],
    force: true,
    predictions: false,
    currentOnly: true,
  });
});
