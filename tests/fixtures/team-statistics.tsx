import { teamFactSummary } from '@/lib/team-facts';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { TeamProfile } from '@/features/profiles/team-profile';
import { createDemoDataset } from '@/services/football/providers/mock';
const data = createDemoDataset(new Date('2026-09-11T12:00:00Z'));
const match = data.matches.find((m) => m.status === 'finished')!;
const team = data.teams.find((t) => t.id === match.homeId)!;
data.matches = [
  {
    ...match,
    statistics: [
      { label: 'Possession', home: 60, away: 40 },
      { label: 'Tirs', home: 0, away: 4 },
    ],
  },
  {
    ...match,
    id: 'away-fixture',
    homeId: match.awayId,
    awayId: match.homeId,
    statistics: [
      { label: 'Possession', home: 80, away: 20 },
      { label: 'Tirs', home: 5, away: 10 },
    ],
  },
  { ...match, id: 'missing-metric', statistics: [] },
];
createRoot(document.getElementById('root')!).render(
  <TeamProfile
    data={data}
    team={team}
    summary={`Résumé de démonstration : ${teamFactSummary(team, data)}`}
  />,
);
