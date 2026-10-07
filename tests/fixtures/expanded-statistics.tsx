import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ProbabilitySummary } from '@/features/matches/probability-summary';
import { MatchStatistics } from '@/features/matches/match-statistics';
import { SourceBanner } from '@/components/source-banner';
import { predictionInsights, informationQuality } from '@/prediction-engine/insights';
import type { Prediction, Team } from '@/types/football';
import fixture from './prediction-statistics.json';
import { createDemoDataset } from '@/services/football/providers/mock';
const prediction = fixture.prediction as Prediction;
const home = fixture.home as Team,
  away = fixture.away as Team;
const match = createDemoDataset(new Date('2026-09-11T12:00:00Z')).matches[0];
function Fixture() {
  const [invalid, setInvalid] = useState(false);
  return (
    <main className="page">
      <h1>Vérification sur données fictives</h1>
      <SourceBanner data={{ source: 'demo', updatedAt: prediction.createdAt }} />
      <h2>Analyse avant-match</h2>
      <button className="button secondary" onClick={() => setInvalid(!invalid)}>
        {invalid ? 'Restaurer la fixture valide' : 'Tester des probabilités incohérentes'}
      </button>
      <ProbabilitySummary
        prediction={invalid ? { ...prediction, home: 0.48, draw: 0.3, away: 0.25 } : prediction}
        home={home}
        away={away}
        analysis={predictionInsights(prediction)}
        quality={informationQuality(prediction)}
        demo
      />
      <h2>Statistiques observées fictives</h2>
      <MatchStatistics
        match={{
          ...match,
          status: 'finished',
          statistics: [
            { label: 'Possession', home: 58, away: 42, unit: '%' },
            { label: 'Tirs', home: 12, away: 8 },
            { label: 'Tirs cadrés', home: 5, away: 3 },
            { label: 'xG', home: 1.5, away: 0.9 },
            { label: 'Corners', home: 4, away: 2 },
            { label: 'Passes', home: 500, away: 300 },
            { label: 'Passes réussies', home: 450, away: 240 },
          ],
        }}
        home={home}
        away={away}
      />
    </main>
  );
}
createRoot(document.getElementById('root')!).render(<Fixture />);
