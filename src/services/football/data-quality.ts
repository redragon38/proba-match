import type { Dataset } from '@/types/football';
export type DataIssue = { status: 'FAIL' | 'WARNING'; code: string; entity: string };
/** Read-only assertions. Missing optional provider values remain null, never manufactured zeros. */
export function validateFootballData(data: Dataset, now = Date.now()) {
  const issues: DataIssue[] = [];
  const add = (code: string, entity: string, status: DataIssue['status'] = 'FAIL') =>
    issues.push({ status, code, entity });
  for (const [kind, rows] of Object.entries({
    competition: data.competitions,
    team: data.teams,
    player: data.players,
    match: data.matches,
  })) {
    for (const key of ['id', 'slug'] as const) {
      const seen = new Set<string>();
      for (const row of rows) {
        if (!row[key] || seen.has(row[key]))
          add(`DUPLICATE_OR_EMPTY_${key.toUpperCase()}`, `${kind}:${row.id}`);
        seen.add(row[key]);
      }
    }
  }
  const teams = new Map(data.teams.map((t) => [t.id, t]));
  const competitions = new Map(data.competitions.map((c) => [c.id, c]));
  const players = new Set(data.players.map((p) => p.id));
  const numeric = (values: Record<string, unknown>, id: string) => {
    for (const [key, value] of Object.entries(values)) {
      if (value == null) continue;
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
        add('INVALID_STATISTIC', `${id}:${key}`);
      if (['passAccuracy'].includes(key) && typeof value === 'number' && value > 100)
        add('INVALID_PERCENTAGE', `${id}:${key}`);
      if (key === 'rating' && typeof value === 'number' && value > 10) add('INVALID_RATING', id);
    }
  };
  const validDate = (value: string) => Number.isFinite(Date.parse(value));
  for (const t of data.teams) {
    if (!t.name.trim()) add('EMPTY_NAME', `team:${t.id}`);
    if (!competitions.has(t.competitionId)) add('TEAM_COMPETITION_MISSING', t.id);
  }
  const homonyms = new Map<string, string[]>();
  for (const p of data.players) {
    if (!p.name.trim()) add('EMPTY_NAME', `player:${p.id}`);
    if (!teams.has(p.teamId)) add('PLAYER_TEAM_MISSING', p.id);
    if (p.birthDate && !validDate(p.birthDate)) add('PLAYER_BIRTH_DATE_INVALID', p.id);
    if (p.photo) {
      try {
        const url = new URL(p.photo);
        if (url.protocol !== 'https:' || url.username || url.password)
          add('PLAYER_PHOTO_INVALID_URL', p.id);
      } catch {
        add('PLAYER_PHOTO_INVALID_URL', p.id);
      }
    }
    numeric(p.stats as unknown as Record<string, unknown>, `player:${p.id}`);
    if (
      p.stats.starts != null &&
      p.stats.appearances != null &&
      p.stats.starts > p.stats.appearances
    )
      add('STARTS_EXCEED_APPEARANCES', p.id);
    const key = `${p.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()}:${p.teamId}:${p.birthDate ?? ''}`;
    const ids = homonyms.get(key) ?? [];
    ids.push(p.id);
    homonyms.set(key, ids);
  }
  for (const ids of homonyms.values())
    if (ids.length > 1)
      add('POSSIBLE_DUPLICATE_PLAYER_REQUIRES_SOURCE_REVIEW', ids.join(','), 'WARNING');
  const fixtures = new Map<string, string>();
  const statuses = new Set([
    'scheduled',
    'live',
    'finished',
    'postponed',
    'cancelled',
    'abandoned',
  ]);
  for (const m of data.matches) {
    if (!teams.has(m.homeId) || !teams.has(m.awayId)) add('MATCH_TEAM_MISSING', m.id);
    if (!competitions.has(m.competitionId)) add('MATCH_COMPETITION_MISSING', m.id);
    if (m.homeId === m.awayId) add('SAME_HOME_AWAY', m.id);
    if (!validDate(m.kickoff)) add('INVALID_KICKOFF', m.id);
    else if (!/(?:Z|[+-]\d{2}:\d{2})$/.test(m.kickoff)) add('KICKOFF_TIMEZONE_MISSING', m.id);
    if (!statuses.has(m.status)) add('INVALID_MATCH_STATUS', m.id);
    for (const score of [m.homeScore, m.awayScore])
      if (score != null && (!Number.isInteger(score) || score < 0)) add('INVALID_SCORE', m.id);
    if (m.status === 'finished' && (m.homeScore == null || m.awayScore == null))
      add('FINISHED_WITHOUT_SCORE', m.id);
    if (m.status === 'finished' && Date.parse(m.kickoff) > now + 300000)
      add('FUTURE_FINISHED_MATCH', m.id);
    const key = `${m.competitionId}:${m.season ?? ''}:${m.homeId}:${m.awayId}:${m.kickoff}`;
    if (fixtures.has(key))
      add('POSSIBLE_DUPLICATE_FIXTURE', `${fixtures.get(key)},${m.id}`, 'WARNING');
    fixtures.set(key, m.id);
    for (const stat of m.statistics) {
      numeric({ home: stat.home, away: stat.away }, `match:${m.id}:${stat.label}`);
      if (
        /possession/i.test(stat.label) &&
        stat.home != null &&
        stat.away != null &&
        (stat.home > 100 || stat.away > 100 || Math.abs(stat.home + stat.away - 100) > 2)
      )
        add('INCOHERENT_POSSESSION', m.id);
    }
    for (const item of [...m.lineups, ...m.events, ...(m.performances ?? [])])
      if (![m.homeId, m.awayId].includes(item.teamId)) add('MATCH_DETAIL_TEAM_MISMATCH', m.id);
    for (const p of m.performances ?? []) {
      numeric(p.stats as unknown as Record<string, unknown>, `performance:${m.id}:${p.playerId}`);
      if (!players.has(p.playerId))
        add('HISTORICAL_PLAYER_NOT_IN_CURRENT_ROSTER', `${m.id}:${p.playerId}`, 'WARNING');
    }
  }
  const failures = issues.filter((i) => i.status === 'FAIL').length;
  return {
    status: failures ? 'FAIL' : issues.length ? 'WARNING' : 'PASS',
    generatedAt: new Date(now).toISOString(),
    counts: {
      competitions: data.competitions.length,
      teams: data.teams.length,
      players: data.players.length,
      matches: data.matches.length,
    },
    failures,
    warnings: issues.length - failures,
    issues,
    limitations: [
      'Transfers and season attribution require provider history; absence of historical roster membership is not proof of a wrong transfer.',
      'Photo availability is checked separately with a bounded sample; URL validity does not prove image availability.',
    ],
  };
}
