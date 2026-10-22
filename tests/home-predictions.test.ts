import { expect, it } from 'vitest';
import { homePredictionCandidates } from '@/services/football/home-predictions';
import { createDemoDataset } from '@/services/football/providers/mock';
it('uses the requested current time, not an old publication timestamp, and ignores invalid results', () => {
  const now = new Date('2026-10-20T12:00:00Z');
  const data = createDemoDataset(now);
  const template = data.matches[0];
  data.updatedAt = '2026-09-01T00:00:00Z';
  data.matches = Array.from({ length: 6 }, (_, i) => ({
    ...template,
    id: 'past' + i,
    status: 'finished' as const,
    kickoff: new Date(+now - (i + 1) * 86400000).toISOString(),
    homeScore: 1,
    awayScore: 0,
  }));
  const target = {
    ...template,
    id: 'target',
    status: 'scheduled' as const,
    kickoff: new Date(+now + 86400000).toISOString(),
    kickoffKnown: true,
  };
  data.matches.push(target);
  expect(homePredictionCandidates(data, +now).map((m) => m.id)).toEqual(['target']);
  expect(homePredictionCandidates(data, +now + 2 * 86400000)).toEqual([]);
  data.matches[0] = { ...data.matches[0], homeScore: -1 };
  data.matches[1] = { ...data.matches[1], awayScore: null };
  expect(homePredictionCandidates(data, +now)).toEqual([]);
});
