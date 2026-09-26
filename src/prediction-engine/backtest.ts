import type { EvaluatedPrediction, Match } from '@/types/football';
import { PredictionEngine } from './index';
export function walkForwardBacktest(matches: Match[]) {
  const engine = new PredictionEngine();
  const result: EvaluatedPrediction[] = [];
  const sorted = matches
    .filter((m) => m.status === 'finished' && m.homeScore !== null && m.awayScore !== null)
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  for (const match of sorted) {
    const before = new Date(new Date(match.kickoff).getTime() - 1000).toISOString();
    const prediction = engine.predict({ ...match, lineups: [] }, sorted, before);
    if (prediction)
      result.push({
        prediction,
        homeScore: match.homeScore!,
        awayScore: match.awayScore!,
        competitionId: match.competitionId,
        kickoff: match.kickoff,
      });
  }
  return result;
}
