import 'server-only';
import { cache } from 'react';
import { getDataset } from './index';

/** Navigation is optional football information; editorial content must survive an outage. */
export const getShellData = cache(async () => {
  try {
    const data = await getDataset();
    return {
      revision: data.revision,
      indexable: data.source !== 'demo' && data.matches.length > 0,
      liveCount: data.degraded ? 0 : data.matches.filter((match) => match.status === 'live').length,
      leagues: data.competitions.map(({ flag, name, slug, logo }) => ({ flag, name, slug, logo })),
    };
  } catch (error) {
    if (!(error instanceof Error) || error.message !== 'FOOTBALL_TEMPORARILY_UNAVAILABLE')
      throw error;
    return { revision: undefined, indexable: false, liveCount: 0, leagues: [] };
  }
});
