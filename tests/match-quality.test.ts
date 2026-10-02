import { describe, expect, it } from 'vitest';
import { createDemoDataset } from '@/services/football/providers/mock';
import { addObservedPlayerProfiles } from '@/services/football/match-profiles';
import { matchQualityIssues } from '@/services/football/match-quality';

describe('liaisons et cohérence des données de match', () => {
  it('crée un profil uniquement depuis un identifiant de composition et ne fusionne pas un homonyme', () => {
    const data = createDemoDataset(new Date('2026-09-12T12:00:00Z'));
    const base = data.matches[0];
    const name = data.players.find((player) => player.teamId === base.homeId)?.name ?? 'Joueur';
    const match = {
      ...base,
      performances: [],
      lineups: [
        {
          teamId: base.homeId,
          formation: '4-4-2',
          confirmed: true,
          starters: [{ id: 'provider-player-777', name, number: 7, row: 1, column: 1 }],
          substitutes: [],
        },
      ],
    };
    expect(addObservedPlayerProfiles(data, match)).toBe(1);
    expect(addObservedPlayerProfiles(data, match)).toBe(0);
    expect(data.players.find((player) => player.id === 'provider-player-777')).toMatchObject({
      teamId: base.homeId,
      name,
      stats: { goals: null },
    });
    expect(matchQualityIssues(match, data.players)).not.toContain('LINEUP_WITHOUT_PLAYER');
  });

  it('signale les incohérences sans convertir zéro ni corriger la source', () => {
    const data = createDemoDataset(new Date('2026-09-12T12:00:00Z'));
    const match = {
      ...data.matches[0],
      lineups: [],
      performances: [],
      events: [],
      statistics: [
        { label: 'Possession', home: 0, away: 75, unit: '%' },
        { label: 'Tirs', home: -1, away: null },
      ],
    };
    expect(matchQualityIssues(match, data.players)).toEqual(
      expect.arrayContaining(['POSSESSION_INCONSISTENT', 'MATCH_STAT_INVALID']),
    );
    expect(match.statistics[0].home).toBe(0);
    expect(match.statistics[1].home).toBe(-1);
  });
});
