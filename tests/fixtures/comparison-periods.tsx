import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Comparator } from '@/features/compare/comparator';
import { createDemoDataset } from '@/services/football/providers/mock';
import { commonComparisonPeriod, comparisonView } from '@/services/football/read-model';
const data = createDemoDataset(new Date('2026-09-11T12:00:00Z'));
data.teams = data.teams.slice(0, 2);
const base = data.matches.find((m) => m.status === 'finished')!;
data.matches = [
  ...Array.from({ length: 20 }, (_, i) => ({
    ...base,
    id: `left-${i}`,
    homeId: data.teams[0].id,
    awayId: 'fixture-opponent',
    kickoff: new Date(Date.UTC(2025, 0, i + 1, 12)).toISOString(),
    statistics: [{ label: 'Tirs', home: 4, away: 1 }],
    provenance: { schedule: 'demo' as const, details: 'api-football' as const },
  })),
  ...[10, 20].map((day) => ({
    ...base,
    id: `right-${day}`,
    homeId: data.teams[1].id,
    awayId: 'fixture-opponent',
    kickoff: new Date(Date.UTC(2025, 0, day, 12)).toISOString(),
    statistics: [{ label: 'Tirs', home: 6, away: 1 }],
    provenance: { schedule: 'demo' as const, details: 'api-football' as const },
  })),
];
const common = commonComparisonPeriod(data, data.teams[0].id, data.teams[1].id);
function Fixture() {
  const [period, setPeriod] = useState<'catalogue' | 'common'>('catalogue');
  return (
    <div
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        setPeriod(new FormData(form).get('period') === 'common' ? 'common' : 'catalogue');
      }}
    >
      <Comparator
        key={period}
        data={data}
        kind="teams"
        summaries={comparisonView(period === 'common' ? common.data : data)}
        periodMode={period}
        commonPeriod={common}
      />
    </div>
  );
}
createRoot(document.getElementById('root')!).render(<Fixture />);
