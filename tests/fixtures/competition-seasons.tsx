import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CompetitionProfile } from '@/features/profiles/competition-profile';
import { createDemoDataset } from '@/services/football/providers/mock';
import { competitionView } from '@/services/competition-view';
const data = createDemoDataset(new Date('2026-09-11T12:00:00Z'));
const competition = data.competitions[0];
const match = data.matches.find((m) => m.competitionId === competition.id)!;
const finished = { ...match, status: 'finished' as const, homeScore: 2, awayScore: 1 };
data.matches = [
  { ...finished, id: 'current-valid', season: competition.season },
  { ...finished, id: 'unspecified', season: undefined, homeScore: 5, awayScore: 5 },
  { ...finished, id: 'invalid', season: competition.season, homeScore: -1 },
  { ...finished, id: 'past-valid', season: competition.season - 1, homeScore: 1, awayScore: 0 },
];
location.hash = '?statut=finished';
function Fixture() {
  const [query, setQuery] = useState(location.hash.slice(1));
  useEffect(() => {
    const update = () => setQuery(location.hash.slice(1));
    window.addEventListener('fixture-query', update);
    return () => window.removeEventListener('fixture-query', update);
  }, []);
  const params = new URLSearchParams(query);
  return (
    <main>
      <button
        onClick={() => {
          location.hash = '?saison=indisponible&statut=finished';
          window.dispatchEvent(new Event('fixture-query'));
        }}
      >
        Tester une saison indisponible
      </button>
      <CompetitionProfile
        view={competitionView(data, competition, {
          saison: params.get('saison') ?? undefined,
          statut: params.get('statut') ?? undefined,
        })}
      />
    </main>
  );
}
createRoot(document.getElementById('root')!).render(<Fixture />);
