import type { Dataset, EvaluatedPrediction, Match } from '@/types/football';

/** Preserve the evaluation population, never serialize unrelated results or reception journals. */
export function performanceView(data: Dataset, rows: EvaluatedPrediction[]) {
  const evaluated = new Set(rows.map((row) => row.prediction.matchId));
  const nonEvaluable = data.matches.filter(
    (m) => m.status === 'finished' && !evaluated.has(m.id),
  ).length;
  const matches: Match[] = data.matches
    .filter((m) => evaluated.has(m.id))
    .map((m) => ({
      id: m.id,
      slug: m.slug,
      homeId: m.homeId,
      awayId: m.awayId,
      competitionId: m.competitionId,
      kickoff: m.kickoff,
      kickoffKnown: m.kickoffKnown,
      status: m.status,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      source: m.source,
      round: m.round,
      updatedAt: m.updatedAt,
      events: [],
      statistics: [],
      lineups: [],
    }));
  const teams = new Set(matches.flatMap((m) => [m.homeId, m.awayId]));
  return {
    nonEvaluable,
    data: {
      ...data,
      matches,
      teams: data.teams.filter((t) => teams.has(t.id)),
      players: [],
      injuries: [],
      standings: {},
    },
    rows: rows.map((row) => ({
      ...row,
      prediction: {
        ...row.prediction,
        inputArchive: undefined,
        factors: [],
        scores: row.prediction.scores?.slice(0, 1),
      },
    })),
  };
}
