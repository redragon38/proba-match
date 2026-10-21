import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TeamProfile } from '@/features/profiles/team-profile';
import { createDemoDataset } from '@/services/football/providers/mock';
import { profileDataset, teamDataset } from '@/services/football/read-model';
import { MatchDetail } from '@/features/matches/match-detail';

describe('Team profile rendered statistics', () => {
  it('preserves all seven match tabs and the full current fixture with compact historical data', () => {
    const data = createDemoDataset(new Date('2026-09-11T12:00:00Z'));
    const match = data.matches.find((row) => row.status === 'finished')!;
    const ids = [match.homeId, match.awayId];
    const previous = teamDataset(data, ids);
    const compact = profileDataset(data, ids, match.id);
    for (const tab of ['apercu', 'prediction', 'statistiques', 'compositions', 'evenements', 'h2h', 'joueurs']) {
      expect(renderToStaticMarkup(createElement(MatchDetail, { data: compact, match, tab }))).toBe(
        renderToStaticMarkup(createElement(MatchDetail, { data: previous, match, tab })),
      );
    }
  });
  it('preserves rendered team content while excluding unused historical details and unrelated entities', () => {
    const data = createDemoDataset(new Date('2026-09-11T12:00:00Z'));
    const team = data.teams[0];
    const previous = teamDataset(data, [team.id]);
    const compact = profileDataset(data, [team.id]);
    expect(renderToStaticMarkup(createElement(TeamProfile, { data: compact, team }))).toBe(
      renderToStaticMarkup(createElement(TeamProfile, { data: previous, team })),
    );
    expect(JSON.stringify(compact).length).toBeLessThan(JSON.stringify(previous).length);
    const match = previous.matches[0];
    const focused = profileDataset(data, [team.id], match.id);
    expect(focused.matches.find((row) => row.id === match.id)).toEqual(match);
    expect(compact.matches.map((row) => row.statistics)).toEqual(previous.matches.map((row) => row.statistics));
    expect(compact.matches.map((row) => [row.id, row.status, row.homeScore, row.awayScore, row.season])).toEqual(
      previous.matches.map((row) => [row.id, row.status, row.homeScore, row.awayScore, row.season]),
    );
    for (const row of compact.matches) {
      expect(compact.teams.some((team) => team.id === row.homeId)).toBe(true);
      expect(compact.teams.some((team) => team.id === row.awayId)).toBe(true);
    }
    expect(data.matches.some((row) => row.lineups.length)).toBe(true);
  });
  it('renders metric units and separate sample counts without treating absence as zero', () => {
    const data = createDemoDataset(new Date('2026-09-11T12:00:00Z'));
    const match = data.matches.find((m) => m.status === 'finished')!;
    const team = data.teams.find((t) => t.id === match.homeId)!;
    data.matches = [
      {
        ...match,
        statistics: [
          { label: 'Possession', home: 60, away: 40 },
          { label: 'Tirs', home: 0, away: 5 },
        ],
      },
      { ...match, id: 'missing-details', statistics: [] },
    ];
    const html = renderToStaticMarkup(createElement(TeamProfile, { data, team }));
    expect(html).toContain('60 %');
    expect(html).toContain('1 match documenté');
    expect(html).toContain('Aucun match documenté');
    expect(html).toContain('Tirs cadrés moyens');
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('Infinity');
    expect(html).toContain('Saison des statistiques');
    expect(html).toContain('Historique cumulé');
    expect(html).toContain('Période : du');
    expect(html).not.toContain('Périmètre :');
  });
});
