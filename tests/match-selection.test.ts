import { describe, expect, it } from 'vitest';
import { createDemoDataset } from '@/services/football/providers/mock';
import { closestMatchDate, matchSelection, upcomingSelection } from '@/services/football/match-selection';
const now = Date.parse('2026-09-26T12:00:00Z');
const data = () => {
  const d = createDemoDataset(new Date(now));
  const base = d.matches[0];
  d.matches = [
    { ...base, id: 'past', status: 'finished' as const, kickoff: '2025-01-01T20:00:00Z' },
    { ...base, id: 'late', status: 'scheduled' as const, kickoff: '2026-09-20T20:00:00Z' },
    { ...base, id: 'next', status: 'scheduled' as const, kickoff: '2026-10-01T20:00:00Z' },
    { ...base, id: 'later', status: 'scheduled' as const, kickoff: '2026-11-01T20:00:00Z' },
    {
      ...base,
      id: 'live',
      status: 'live' as const,
      phase: 'halftime' as const,
      kickoff: '2026-09-26T11:00:00Z',
    },
  ];
  return d;
};
describe('match catalogue selection', () => {
  it('does not restrict all and finished tabs to today', () => {
    expect(matchSelection(data(), {}, now).total).toBe(5);
    expect(matchSelection(data(), { statut: 'finished' }, now).matches.map((m) => m.id)).toEqual([
      'past',
    ]);
    expect(matchSelection(data(), { statut: 'scheduled' }, now).matches.map((m) => m.id)).toEqual([
      'next',
      'later',
    ]);
    expect(matchSelection(data(), { statut: 'live' }, now).matches[0].phase).toBe('halftime');
  });
  it('paginates without duplicates and clamps a page after filtering', () => {
    const first = matchSelection(data(), { limit: '2' }, now),
      second = matchSelection(data(), { limit: '2', page: '2' }, now);
    expect(first.hasNextPage).toBe(true);
    expect(second.matches.every((m) => !first.matches.some((x) => x.id === m.id))).toBe(true);
    expect(matchSelection(data(), { statut: 'finished', page: '999' }, now).page).toBe(1);
    expect(() => matchSelection(data(), { limit: '101' }, now)).toThrow();
    expect(() => matchSelection(data(), { date: '2026-02-30' }, now)).toThrow();
  });
  it('handles local midnight and date-only fixtures without timezone shifts', () => {
    const d = data();
    d.matches = [{ ...d.matches[0], kickoff: '2026-09-25T23:30:00Z', kickoffKnown: true }];
    expect(matchSelection(d, { date: '2026-09-26', timezone: 'Europe/Paris' }, now).total).toBe(1);
    expect(matchSelection(d, { date: '2026-09-26', timezone: 'America/New_York' }, now).total).toBe(
      0,
    );
    d.matches[0].kickoffKnown = false;
    d.matches[0].sourceDate = '2026-09-26';
    expect(matchSelection(d, { date: '2026-09-26', timezone: 'America/New_York' }, now).total).toBe(
      1,
    );
  });
  it('features genuine future fixtures beyond today without requiring predictions', () => {
    expect(upcomingSelection(data(), now).map((m) => m.id)).toEqual(['next', 'later']);
    expect(upcomingSelection({ ...data(), matches: [] }, now)).toEqual([]);
  });
  it('selects an honest available matchday when the current day is empty', () => {
    const d = data();
    d.matches = [
      { ...d.matches[0], id: 'result', status: 'finished', kickoff: '2026-09-20T20:00:00Z' },
      { ...d.matches[0], id: 'fixture', status: 'scheduled', kickoff: '2026-10-09T20:00:00Z' },
    ];
    expect(closestMatchDate(d, 'all', now)).toBe('2026-09-20');
    expect(closestMatchDate(d, 'favorites', now)).toBe('2026-09-20');
    expect(closestMatchDate(d, 'finished', now)).toBe('2026-09-20');
    expect(closestMatchDate(d, 'scheduled', now)).toBe('2026-10-09');
    expect(closestMatchDate(d, 'live', now)).toBe('2026-09-26');
    d.matches.push({ ...d.matches[0], id: 'today', kickoff: '2026-09-26T08:00:00Z' });
    expect(closestMatchDate(d, 'all', now)).toBe('2026-09-26');
  });
});
