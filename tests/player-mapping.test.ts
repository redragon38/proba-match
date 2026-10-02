import { describe, it, expect } from 'vitest';
import { mapMatchPlayers, mapPosition } from '@/services/football/providers/player-mapping';
import { createDemoDataset } from '@/services/football/providers/mock';
import { playerPerformance } from '@/prediction-engine/player';
describe('Statistiques individuelles par match', () => {
  it('préserve les métriques manquantes et identifie les gardiens', () => {
    const rows = mapMatchPlayers([
      {
        team: { id: 1 },
        players: [
          {
            player: { id: 9, name: 'Gardien' },
            statistics: [
              {
                games: { minutes: 90, position: 'G', rating: '7.2' },
                goals: { saves: 5, conceded: 1 },
                passes: { total: 20, key: 0, accuracy: '75%' },
                tackles: { total: 0, blocks: 2, interceptions: 1 },
                duels: { total: 4, won: 3 },
                fouls: { committed: 0 },
              },
            ],
          },
        ],
      },
    ]);
    expect(rows[0].position).toBe('Gardien');
    expect(rows[0].stats.shots).toBeNull();
    expect(rows[0].stats.passAccuracy).toBe(75);
    expect(rows[0].stats.keyPasses).toBe(0);
    expect(rows[0].stats.duelsTotal).toBe(4);
    expect(rows[0].stats.fouls).toBe(0);
    expect(playerPerformance(rows[0].stats, rows[0].position)).toBeGreaterThan(0);
  });
  it('n’assigne pas arbitrairement un poste en cas d’absence', () => {
    expect(mapPosition(null)).toBe('Non disponible');
    expect(mapMatchPlayers(undefined)).toEqual([]);
  });
  it('lie les buts fictifs aux événements et sépare les statistiques saisonnières', () => {
    const data = createDemoDataset(new Date('2026-09-12T12:00:00Z'));
    const m = data.matches.find((m) => m.id === 'demo-0-5')!;
    expect(m.performances).toHaveLength(22);
    expect(m.performances!.reduce((s, p) => s + (p.stats.goals ?? 0), 0)).toBe(
      m.homeScore! + m.awayScore!,
    );
    expect(m.performances!.every((p) => p.stats.minutes === 90)).toBe(true);
  });
});
