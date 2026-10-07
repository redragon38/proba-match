import type { Dataset } from '@/types/football';
import { validResult } from '@/prediction-engine/availability';
import { playerWatch } from '@/prediction-engine/player';
import { derivedStandings } from '@/services/derived-standings';
import type { Standing } from '@/types/football';
import { teamSummary, teamMetricAverage, teamMetricSummary } from '@/services/statistics';
/** Only genuine overlap is called common; no overlap produces no comparable values. */
export function commonComparisonPeriod(
  data: Dataset,
  a: string,
  b: string,
  cutoff = new Date().toISOString(),
) {
  const bounds = (id: string) =>
    data.matches
      .filter(
        (m) =>
          validResult(m) &&
          Date.parse(m.kickoff) < Date.parse(cutoff) &&
          [m.homeId, m.awayId].includes(id),
      )
      .map((m) => Date.parse(m.kickoff))
      .sort((a, b) => a - b);
  const left = bounds(a),
    right = bounds(b);
  const from = Math.max(left.at(0) ?? Infinity, right.at(0) ?? Infinity);
  const to = Math.min(left.at(-1) ?? -Infinity, right.at(-1) ?? -Infinity);
  const available = Number.isFinite(from) && Number.isFinite(to) && from <= to;
  return {
    data: {
      ...data,
      matches: available
        ? data.matches.filter((m) => Date.parse(m.kickoff) >= from && Date.parse(m.kickoff) <= to)
        : [],
    },
    from: available ? new Date(from).toISOString() : undefined,
    to: available ? new Date(to).toISOString() : undefined,
  };
}
export function comparisonView(data: Dataset) {
  // Index once: each fixture belongs to at most two team histories.
  const histories = new Map<string, Dataset['matches']>();
  for (const match of data.matches) {
    for (const id of new Set([match.homeId, match.awayId])) {
      const history = histories.get(id) ?? [];
      history.push(match);
      histories.set(id, history);
    }
  }
  const cutoff = new Date().toISOString();
  const summary = (scoped: Dataset, id: string, venue: 'all' | 'home' | 'away') => {
    const value = teamSummary(scoped, id, cutoff, venue);
    return { ...value, matches: [], lastTen: [] };
  };
  return Object.fromEntries(
    data.teams.map((team) => {
      const scoped = { ...data, matches: histories.get(team.id) ?? [] };
      return [
        team.id,
        {
          all: summary(scoped, team.id, 'all'),
          home: summary(scoped, team.id, 'home'),
          away: summary(scoped, team.id, 'away'),
          coverage: Object.fromEntries(
            ['xG', 'Possession', 'Tirs'].map((label) => [
              label,
              teamMetricSummary(scoped, team.id, label),
            ]),
          ),
          period: {
            from: scoped.matches
              .filter((m) => validResult(m) && Date.parse(m.kickoff) < Date.parse(cutoff))
              .map((m) => m.kickoff)
              .sort()
              .at(0),
            to: scoped.matches
              .filter((m) => validResult(m) && Date.parse(m.kickoff) < Date.parse(cutoff))
              .map((m) => m.kickoff)
              .sort()
              .at(-1),
          },
          xg: teamMetricAverage(scoped, team.id, 'xG'),
          possession: teamMetricAverage(scoped, team.id, 'Possession'),
          shots: teamMetricAverage(scoped, team.id, 'Tirs'),
        },
      ];
    }),
  );
}
export function standingsView(data: Dataset) {
  const cached = standingsCache.get(data.matches);
  if (
    data.source !== 'demo' &&
    cached &&
    cached.competitions === data.competitions &&
    cached.standings === data.standings
  )
    return {
      data: { ...catalogDataset(data), players: [] },
      seasons: cached.seasons,
      tables: cached.tables,
    };
  const seasons: Record<string, number[]> = {};
  const tables: Record<string, Standing[]> = {};
  for (const competition of data.competitions) {
    const matches = data.matches.filter((m) => m.competitionId === competition.id);
    seasons[competition.id] = [
      ...new Set([competition.season, ...matches.map((m) => m.season ?? competition.season)]),
    ].sort((a, b) => b - a);
    for (const season of seasons[competition.id]) {
      const year = matches.filter((m) => (m.season ?? competition.season) === season);
      for (const scope of ['general', 'home', 'away', 'last5'] as const) {
        tables[`${competition.id}:${season}:${scope}`] =
          scope === 'general' && season === competition.season
            ? (data.standings[competition.id] ?? [])
            : derivedStandings(year, competition.id, scope);
      }
    }
  }
  if (data.source !== 'demo')
    standingsCache.set(data.matches, {
      competitions: data.competitions,
      standings: data.standings,
      seasons,
      tables,
    });
  return { data: { ...catalogDataset(data), players: [] }, seasons, tables };
}
const standingsCache = new WeakMap<
  Dataset['matches'],
  {
    competitions: Dataset['competitions'];
    standings: Dataset['standings'];
    seasons: Record<string, number[]>;
    tables: Record<string, Standing[]>;
  }
>();
/** Catalogues never use fixtures, injuries or standings. */
export function catalogDataset(data: Dataset): Dataset {
  return {
    ...data,
    matches: [],
    injuries: [],
    standings: {},
    // Catalogue cards and client search need identities, never full profiles or image licences.
    players: data.players.map(({ id, slug, name, teamId, position, source }) => ({
      id,
      slug,
      name,
      teamId,
      position,
      source,
      number: null,
      stats: {
        appearances: null,
        starts: null,
        minutes: null,
        goals: null,
        assists: null,
        rating: null,
      },
    })),
  };
}
/** Preserve the full relevant history without shipping other teams' matches. */
export function teamDataset(data: Dataset, ids: string[]): Dataset {
  return {
    ...data,
    matches: data.matches.filter((m) => ids.includes(m.homeId) || ids.includes(m.awayId)),
    players: data.players.filter((p) => ids.includes(p.teamId)),
    injuries: data.injuries.filter((i) => ids.includes(i.teamId)),
  };
}
export function competitionDataset(data: Dataset, id: string): Dataset {
  const matches = data.matches.filter((m) => m.competitionId === id);
  const teams = new Set(matches.flatMap((m) => [m.homeId, m.awayId]));
  return {
    ...data,
    matches,
    players: data.players.filter((p) => teams.has(p.teamId)),
    injuries: [],
    standings: { [id]: data.standings[id] ?? [] },
  };
}
/** Do not serialize the historical corpus or a complete roster into the match dashboard. */
export function dashboardDataset(data: Dataset, date: string): Dataset {
  const start = new Date(`${date}T00:00:00Z`).getTime() - 86400_000;
  return {
    ...data,
    matches: data.matches
      .filter((m) => {
        const d = new Date(m.kickoff).getTime();
        return d >= start && d < start + 5 * 86400_000;
      })
      .map((m) => ({
        ...m,
        performances: undefined,
        lineups: [],
        statistics: m.status === 'live' ? m.statistics : [],
      })),
    players: [...data.players]
      .sort((a, b) => (playerWatch(b) ?? -1) - (playerWatch(a) ?? -1))
      .slice(0, 12),
    standings: {},
    injuries: [],
  };
}
