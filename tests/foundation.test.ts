import { describe, expect, it } from 'vitest';
import { createDemoDataset } from '@/services/football/providers/mock';
import { dateKey } from '@/lib/format';

describe('Dates utilisateur autour de minuit', () => {
  it('regroupe le même instant UTC dans le jour local approprié', () => {
    const instant = new Date('2026-09-20T23:30:00Z');
    expect(dateKey(instant, 'Europe/Paris')).toBe('2026-09-21');
    expect(dateKey(instant, 'America/New_York')).toBe('2026-09-20');
    expect(dateKey(instant, 'Asia/Tokyo')).toBe('2026-09-21');
  });
  it('conserve la date lors du passage à l’heure d’hiver', () => {
    expect(dateKey(new Date('2026-10-25T00:30:00Z'), 'Europe/Paris')).toBe('2026-10-25');
    expect(dateKey(new Date('2026-10-25T01:30:00Z'), 'Europe/Paris')).toBe('2026-10-25');
  });
});
describe('Catalogue de démonstration', () => {
  it('relie tous les matchs et joueurs à des équipes existantes', () => {
    const d = createDemoDataset();
    const ids = new Set(d.teams.map((t) => t.id));
    expect(d.matches.every((m) => ids.has(m.homeId) && ids.has(m.awayId))).toBe(true);
    expect(d.players.every((p) => ids.has(p.teamId))).toBe(true);
  });
  it('contient les trois états principaux à la date de Paris', () => {
    const now = new Date('2026-09-11T23:30:00Z');
    const d = createDemoDataset(now);
    const matches = d.matches.filter((m) => dateKey(new Date(m.kickoff)) === dateKey(now));
    expect(new Set(matches.map((m) => m.status))).toEqual(
      new Set(['live', 'scheduled', 'finished']),
    );
  });
});
