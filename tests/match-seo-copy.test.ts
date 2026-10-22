import { describe, expect, it } from 'vitest';
import { createDemoDataset } from '@/services/football/providers/mock';
import { matchSeoCopy } from '@/lib/match-facts';

describe('status-aware match metadata', () => {
  const data = createDemoDataset(new Date('2026-09-11T12:00:00Z'));
  const base = data.matches[0];
  const home = data.teams.find((team) => team.id === base.homeId)!.name;
  const away = data.teams.find((team) => team.id === base.awayId)!.name;

  it('describes a confirmed result without announcing unavailable content', () => {
    const copy = matchSeoCopy(
      { ...base, status: 'finished', homeScore: 0, awayScore: 0 },
      data,
    );
    expect(copy.title).toContain(`${home}–${away} : résultat 0–0`);
    expect(copy.description).toContain('Score enregistré : 0–0');
  });

  it('announces analysis only when a pre-match forecast exists', () => {
    const scheduled = { ...base, status: 'scheduled' as const, homeScore: null, awayScore: null };
    expect(matchSeoCopy(scheduled, data, true).title).toContain('analyse et probabilités');
    expect(matchSeoCopy(scheduled, data, false).title).not.toContain('probabilités');
  });

  it('uses live wording only for a live provider status', () => {
    expect(matchSeoCopy({ ...base, status: 'live' }, data).title).toContain('en direct');
    expect(
      matchSeoCopy(
        { ...base, status: 'scheduled', homeScore: null, awayScore: null },
        data,
      ).title,
    ).not.toContain('en direct');
  });

  it('distinguishes two documented kickoff times on the same day without inventing unknown times', () => {
    const first = { ...base, kickoffKnown: true, kickoff: '2026-09-11T12:00:00Z', status: 'finished' as const, homeScore: 1, awayScore: 0 };
    const second = { ...first, id: 'second-fixture', kickoff: '2026-09-11T18:00:00Z' };
    const a = matchSeoCopy(first, data), b = matchSeoCopy(second, data);
    expect(a.title).not.toBe(b.title);
    expect(a.description).not.toBe(b.description);
    expect(a.title).toContain('14:00');
    expect(b.description).toContain('20:00');
    const unknown = matchSeoCopy({ ...first, kickoffKnown: false, sourceDate: '2026-09-11' }, data);
    expect(unknown.title).not.toContain('14:00');
    expect(unknown.description).not.toContain('14:00');
  });
});
