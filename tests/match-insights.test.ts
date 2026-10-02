import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createDemoDataset } from '@/services/football/providers/mock';
import { PlayerPerformances } from '@/features/matches/player-performances';
import {
  MatchStatistics,
  matchStatsSummary,
  statReading,
} from '@/features/matches/match-statistics';

vi.mock('next/link', () => ({ default: 'a' }));
const data = createDemoDataset(new Date('2026-09-12T12:00:00Z'));
const match = data.matches.find((row) => row.id === 'demo-0-5')!;
const home = data.teams.find((team) => team.id === match.homeId)!;
const away = data.teams.find((team) => team.id === match.awayId)!;

describe('joueurs et statistiques du match', () => {
  it('montre les profils connus sans les présenter comme participants quand aucune composition n’existe', () => {
    const html = renderToStaticMarkup(
      createElement(PlayerPerformances, {
        match: { ...match, lineups: [], performances: [] },
        data,
      }),
    );
    expect(html).toContain('participation non confirmée');
    expect(html).toContain(
      `/joueur/${data.players.find((player) => player.teamId === home.id)?.slug}`,
    );
    expect(html).not.toContain('Titulaires');
  });

  it('relie titulaires, remplaçants et statistiques réelles du match sans perdre les zéros', () => {
    const html = renderToStaticMarkup(
      createElement(PlayerPerformances, { match: { ...match, status: 'live' }, data }),
    );
    expect(html).toContain('Titulaires');
    expect(html).toContain('Remplaçants');
    expect(html).toContain('Voir toutes les statistiques individuelles');
    expect(html).not.toContain('undefined');
    expect(html).not.toContain('NaN');
  });

  it('affiche les métriques transmises, masque les absentes et garde domicile/extérieur', () => {
    const stats = [
      { label: 'Possession', home: 58, away: 42, unit: '%' },
      { label: 'Tirs cadrés', home: 6, away: 3 },
      { label: 'xG', home: null, away: 0 },
    ];
    const html = renderToStaticMarkup(
      createElement(MatchStatistics, { match: { ...match, statistics: stats }, home, away }),
    );
    expect(html).toContain('58%');
    expect(html).toContain('42%');
    expect(html).toContain('Tirs cadrés');
    expect(html).toContain('—');
    expect(html).toContain('0');
    expect(html).not.toContain('NaN');
    expect(matchStatsSummary(stats, home, away)).toContain('Possession');
    expect(statReading(stats[0], home, away)).toContain(home.short);
  });
});
