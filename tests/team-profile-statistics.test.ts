import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TeamProfile } from '@/features/profiles/team-profile';
import { createDemoDataset } from '@/services/football/providers/mock';

describe('Team profile rendered statistics', () => {
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
  });
});
