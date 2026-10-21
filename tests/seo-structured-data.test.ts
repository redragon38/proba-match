import { expect, it } from 'vitest';
import { structuredDataIssues } from '../scripts/seo-structured-data.mjs';
it('catches the externally confirmed missing location and unsupported event statuses', () => {
  const event = {
    '@type': 'SportsEvent',
    name: 'Match',
    startDate: '2026-10-21',
    eventStatus: 'https://schema.org/EventScheduled',
  };
  expect(structuredDataIssues([event])).toHaveLength(1);
  const complete = { ...event, location: { name: 'Verified venue', address: 'Verified address' } };
  expect(structuredDataIssues({ '@graph': [complete] })).toEqual([]);
  expect(
    structuredDataIssues({ ...complete, eventStatus: 'https://schema.org/EventCompleted' }),
  ).toContain('Unsupported Schema.org EventStatusType');
  expect(
    structuredDataIssues([
      { '@type': 'WebPage', about: [{ '@type': 'SportsTeam', name: 'Team' }] },
    ]),
  ).toEqual([]);
});
