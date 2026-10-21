import type { Dataset, EvaluatedPrediction } from '@/types/football';
import { metrics } from '@/prediction-engine/evaluation';
import { competitionSeason } from '@/lib/competition-season';

export type ReportFilters = Record<
  'competition' | 'month' | 'confidence' | 'period' | 'version',
  string
>;
export function reportBreakdowns(rows: EvaluatedPrediction[], data: Pick<Dataset, 'competitions'>) {
  const keys = [
    [
      'Par compétition',
      (r: EvaluatedPrediction) =>
        data.competitions.find((c) => c.id === r.competitionId)?.name ?? r.competitionId,
    ],
    ['Par mois', (r: EvaluatedPrediction) => r.kickoff.slice(0, 7)],
    [
      'Par saison',
      (r: EvaluatedPrediction) =>
        r.season == null
          ? 'Saison non renseignée'
          : competitionSeason(
              data.competitions.find((c) => c.id === r.competitionId),
              r.season,
            ),
    ],
    ['Par version', (r: EvaluatedPrediction) => r.prediction.version],
    [
      'Par qualité des informations',
      (r: EvaluatedPrediction) =>
        r.prediction.confidence >= 70 ? '70–100' : r.prediction.confidence >= 50 ? '50–69' : '0–49',
    ],
  ] as const;
  return keys.map(([title, key]) => {
    const groups = new Map<string, EvaluatedPrediction[]>();
    for (const row of rows) {
      const name = key(row);
      const group = groups.get(name) ?? [];
      group.push(row);
      groups.set(name, group);
    }
    return {
      title,
      entries: [...groups]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, group]) => {
          const m = metrics(group)!;
          return {
            key,
            stats: { sample: m.sample, accuracy: m.accuracy, brier: m.brier, logLoss: m.logLoss },
          };
        }),
    };
  });
}
export function prepareReport(
  rows: EvaluatedPrediction[],
  data: Dataset,
  query: Record<string, string | string[] | undefined>,
) {
  const value = (key: string) => (typeof query[key] === 'string' ? (query[key] as string) : 'all');
  const filters: ReportFilters = {
    competition: value('competition'),
    month: value('month'),
    confidence: value('confidence'),
    period: value('period'),
    version: value('version'),
  };
  const reference = Date.parse(data.updatedAt) || 0;
  const july = `${new Date(reference).getUTCFullYear() - (new Date(reference).getUTCMonth() < 6 ? 1 : 0)}-07-01`;
  const filtered = rows.filter(
    (r) =>
      (filters.competition === 'all' || r.competitionId === filters.competition) &&
      (filters.month === 'all' || r.kickoff.startsWith(filters.month)) &&
      (filters.version === 'all' || r.prediction.version === filters.version) &&
      (filters.confidence === 'all' ||
        (filters.confidence === 'high'
          ? r.prediction.confidence >= 70
          : r.prediction.confidence < 70)) &&
      (filters.period === 'all' ||
        (filters.period === 'season'
          ? r.kickoff >= july
          : ['7', '30', '90'].includes(filters.period) &&
            Date.parse(r.kickoff) >= reference - Number(filters.period) * 86400000)),
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / 20));
  const requestedPage = Number(query.page);
  const page = Math.min(
    pageCount,
    Number.isSafeInteger(requestedPage) ? Math.max(1, requestedPage) : 1,
  );
  const evaluated = new Set(rows.map((r) => r.prediction.matchId));
  const pageRows = filtered.slice((page - 1) * 20, page * 20).map((row) => {
    const prediction = { ...row.prediction };
    delete prediction.inputArchive;
    prediction.factors = [];
    return { ...row, prediction };
  });
  const pageIds = new Set(pageRows.map((r) => r.prediction.matchId));
  const matches = data.matches
    .filter((m) => pageIds.has(m.id))
    .map((m) => ({
      ...m,
      lineups: [],
      events: [],
      performances: [],
      statistics: [],
      resultRevisions: [],
    }));
  const teamIds = new Set(matches.flatMap((m) => [m.homeId, m.awayId]));
  return {
    rows: pageRows,
    data: {
      ...data,
      matches,
      teams: data.teams.filter((t) => teamIds.has(t.id)),
      players: [],
      injuries: [],
      standings: {},
    },
    summary: {
      filters,
      page,
      pageCount,
      total: rows.length,
      filteredCount: filtered.length,
      distinct: new Set(filtered.map((r) => r.prediction.matchId)).size,
      nonEvaluable: data.matches.filter((m) => m.status === 'finished' && !evaluated.has(m.id))
        .length,
      stats: metrics(filtered),
      referenceStats: metrics(
        filtered.map((r) => ({
          ...r,
          prediction: { ...r.prediction, home: 1 / 3, draw: 1 / 3, away: 1 / 3 },
        })),
      ),
      versions: [...new Set(rows.map((r) => r.prediction.version))],
      months: [...new Set(rows.map((r) => r.kickoff.slice(0, 7)))].sort().reverse(),
      first: filtered.reduce((v, r) => Math.min(v, Date.parse(r.kickoff)), Infinity),
      last: filtered.reduce((v, r) => Math.max(v, Date.parse(r.kickoff)), -Infinity),
      breakdowns: reportBreakdowns(filtered, data),
    },
  };
}
export type ReportSummary = ReturnType<typeof prepareReport>['summary'];
