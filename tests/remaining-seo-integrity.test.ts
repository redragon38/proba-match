import { describe, expect, it, vi, afterEach } from 'vitest';
import { dateKey, time } from '@/lib/format';
import { matchDateKey } from '@/lib/match-date';
import { derivedStandings } from '@/services/derived-standings';
import { standingsView } from '@/services/football/read-model';
import { createDemoDataset } from '@/services/football/providers/mock';

const data = createDemoDataset(new Date('2026-09-11T12:00:00Z'));
const fixture = data.matches.find((m) => m.status === 'finished')!;
describe('remaining audit regressions', () => {
  afterEach(() => vi.useRealTimers());
  it('isolates seasons and counts a repeated fixture ID only once', () => {
    const current = { ...fixture, id: 'current', season: 2026 };
    const past = { ...fixture, id: 'past', season: 2025 };
    const rows = derivedStandings([current, current, past], fixture.competitionId, 'general', 2026);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.played === 1 && r.points === r.won * 3 + r.drawn)).toBe(true);
    expect(rows.reduce((sum, r) => sum + r.scored - r.conceded, 0)).toBe(0);
  });
  it('exposes a deduplicated count for the selected competition and season', () => {
    const competition = data.competitions.find((c) => c.id === fixture.competitionId)!;
    const current = { ...fixture, season: competition.season };
    const result = standingsView({
      ...data,
      matches: [
        current,
        current,
        { ...current, id: 'past', season: competition.season - 1 },
        { ...current, id: 'postponed', status: 'postponed' },
        { ...current, id: 'excluded', countsForStandings: false },
      ],
    });
    expect(result.matchCounts[`${competition.id}:${competition.season}`]).toBe(1);
    expect(result.matchCounts[`${competition.id}:${competition.season - 1}`]).toBe(1);
  });
  it.each([
    ['2026-03-28T23:30:00Z', '2026-03-29', '00:30'],
    ['2026-03-29T01:30:00Z', '2026-03-29', '03:30'],
    ['2026-10-25T00:30:00Z', '2026-10-25', '02:30'],
    ['2026-10-25T01:30:00Z', '2026-10-25', '02:30'],
    ['2026-10-21T22:30:00Z', '2026-10-22', '00:30'],
  ])('uses Paris calendar boundaries at %s', (instant, day, hour) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(instant));
    expect(dateKey()).toBe(day);
    expect(matchDateKey({ kickoff: instant, kickoffKnown: true })).toBe(day);
    expect(time(instant)).toBe(hour);
  });
  it('preserves date-only results independently of visitor timezone', () => {
    const match = {
      kickoff: '2026-03-28T23:00:00Z',
      kickoffKnown: false,
      sourceDate: '2026-03-29',
    };
    for (const zone of ['Europe/Paris', 'America/New_York', 'Asia/Tokyo'])
      expect(matchDateKey(match, zone)).toBe('2026-03-29');
  });
});
