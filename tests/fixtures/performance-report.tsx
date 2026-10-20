import { createRoot } from 'react-dom/client';
import { Performance } from '@/features/performance/performance';
import { createDemoDataset } from '@/services/football/providers/mock';
import type { Prediction } from '@/types/football';
import { performanceView } from '@/services/performance-view';
const data = createDemoDataset(new Date('2026-09-11T12:00:00Z'));
const target = data.matches.find((m) => m.id === 'demo-0-2')!;
// Explicitly synthetic values used only in this browser fixture, never in production.
const p: Prediction = {
  id: 'fixture',
  matchId: target.id,
  version: 'fixture',
  createdAt: data.updatedAt,
  cutoff: data.updatedAt,
  home: 0.5,
  draw: 0.3,
  away: 0.2,
  expectedHome: 1.2,
  expectedAway: 1,
  likelyScore: '1–1',
  scores: [{ home: 1, away: 1, probability: 0.2 }],
  cleanHome: 0.3,
  cleanAway: 0.2,
  confidence: 50,
  sample: 20,
  factors: [],
  inputHash: 'fixture',
  lineupConfirmed: false,
};
const rows = ['v1', 'v2'].map((version, i) => ({
  prediction: { ...p, id: 'p-' + i, version },
  homeScore: i,
  awayScore: 1,
  competitionId: target.competitionId,
  kickoff: target.kickoff,
}));
const view = performanceView(data, rows);
createRoot(document.getElementById('fixture')!).render(
  <main>
    <Performance
      data={view.data}
      rows={view.rows}
      demo
      publicReport
      nonEvaluable={view.nonEvaluable}
    />
  </main>,
);
