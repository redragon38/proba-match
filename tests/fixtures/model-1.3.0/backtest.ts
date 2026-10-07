import type { EvaluatedPrediction, Match } from '@/types/football';
import { PredictionEngine, MODEL_VERSION } from './index';
import { validResult, type AvailabilityMode } from './availability';
export function walkForwardBacktest(
  matches: Match[],
  mode: AvailabilityMode = 'observed',
  parameters: { homeAdvantage?: number; halfLifeDays?: number; goalStrength?: number } = {},
) {
  if (new Set(matches.map((m) => m.id)).size !== matches.length)
    throw new Error('DUPLICATE_MATCH_ID');
  const homeAdvantage = parameters.homeAdvantage ?? 60;
  const halfLifeDays = parameters.halfLifeDays ?? 60;
  const goalStrength = parameters.goalStrength ?? 0.8;
  if (
    !Number.isFinite(homeAdvantage) ||
    !Number.isFinite(halfLifeDays) ||
    halfLifeDays <= 0 ||
    !Number.isFinite(goalStrength) ||
    goalStrength <= 0 ||
    goalStrength > 1
  )
    throw new Error('INVALID_BACKTEST_PARAMETERS');
  const customized = homeAdvantage !== 60 || halfLifeDays !== 60 || goalStrength !== 0.8;
  const engine = new PredictionEngine(
    homeAdvantage,
    halfLifeDays,
    goalStrength,
    customized
      ? `research-${MODEL_VERSION}-h${homeAdvantage}-d${halfLifeDays}-s${goalStrength}`
      : MODEL_VERSION,
    mode,
  );
  const result: EvaluatedPrediction[] = [];
  const sorted = matches
    .filter(validResult)
    .sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff) || a.id.localeCompare(b.id));
  for (const match of sorted) {
    const targetTime =
      match.kickoffKnown === false
        ? Date.parse(`${(match.sourceDate ?? match.kickoff).slice(0, 10)}T00:00:00Z`)
        : Date.parse(match.kickoff);
    const before = new Date(targetTime - 1000).toISOString();
    const prediction = engine.predict(
      {
        ...match,
        status: 'scheduled',
        homeScore: null,
        awayScore: null,
        events: [],
        statistics: [],
        performances: [],
        scoreBreakdown: undefined,
        resultObservedAt: undefined,
        lineups: [],
      },
      sorted,
      before,
    );
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
