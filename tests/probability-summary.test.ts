import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import type { Prediction, Team } from '@/types/football';
import { informationQuality } from '@/prediction-engine/insights';
import { ProbabilitySummary } from '@/features/matches/probability-summary';

vi.mock('next/link', () => ({ default: 'a' }));
const team = (name: string, short: string): Team => ({
  id: short,
  slug: short,
  name,
  short,
  color: '#16856b',
  country: 'France',
  competitionId: 'test',
});
const home = team('Olympique Lyonnais', 'Lyon');
const away = team('Olympique de Marseille', 'OM');
const base: Prediction = {
  id: 'snapshot',
  matchId: 'match',
  version: 'v1',
  createdAt: '2026-09-01T12:00:00Z',
  cutoff: '2026-09-01T12:00:00Z',
  home: 0.52,
  draw: 0.27,
  away: 0.21,
  expectedHome: 1.8,
  expectedAway: 1.2,
  likelyScore: '2–1',
  scores: [
    { home: 2, away: 1, probability: 0.12 },
    { home: 1, away: 1, probability: 0.11 },
  ],
  cleanHome: 0.3,
  cleanAway: 0.2,
  confidence: 75,
  sample: 15,
  inputHash: 'hash',
  lineupConfirmed: true,
  factors: [
    {
      label: 'Production offensive récente',
      detail: 'Domicile : 1,8 ; extérieur : 1,2.',
      side: 'home',
    },
  ],
};
const render = (prediction: Prediction) =>
  renderToStaticMarkup(
    createElement(ProbabilitySummary, {
      prediction,
      home,
      away,
      quality: informationQuality(prediction),
      demo: false,
    }),
  );

describe('résumé des probabilités publiées', () => {
  it('montre les noms, le 1N2, la probabilité du score et une raison réellement enregistrée', () => {
    const html = render(base);
    for (const text of [
      'Olympique Lyonnais',
      'Match nul',
      'Olympique de Marseille',
      '52 %',
      '27 %',
      '21 %',
      '2–1',
      '12 % pour ce score précis',
      'Production offensive récente',
    ])
      expect(html).toContain(text);
    expect(html).toContain('Voir l’analyse détaillée');
    expect(html).not.toContain('VA GAGNER');
  });

  it('n’invente ni score ni pourcentage en cas de données partielles', () => {
    const html = render({ ...base, scores: [], confidence: 30, sample: 4, lineupConfirmed: false });
    expect(html).toContain('Non disponible');
    expect(html).toContain('Faible');
    expect(html).not.toContain('0 % pour ce score précis');
  });

  it('ne met pas arbitrairement en avant une issue d’un match serré', () => {
    const html = render({ ...base, home: 0.35, draw: 0.32, away: 0.33 });
    expect(html).toContain('Très équilibré');
    expect(html).not.toContain('prediction-outcome is-leading');
  });
});
