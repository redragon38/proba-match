import { dateKey } from './format';
import type { Match } from '@/types/football';

/** Date-only provider values are calendar dates, never midnight UTC kickoffs. */
export function matchDateKey(
  match: Pick<Match, 'kickoff' | 'kickoffKnown' | 'sourceDate'>,
  timeZone = 'Europe/Paris',
) {
  return match.kickoffKnown === false
    ? (match.sourceDate ?? match.kickoff.slice(0, 10))
    : dateKey(new Date(match.kickoff), timeZone);
}
