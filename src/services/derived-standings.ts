import type { Match, Standing } from '@/types/football';
export type StandingMatch = Pick<
  Match,
  | 'competitionId'
  | 'season'
  | 'status'
  | 'homeScore'
  | 'awayScore'
  | 'kickoff'
  | 'homeId'
  | 'awayId'
>;
export function derivedStandings(
  matches: StandingMatch[],
  competitionId: string,
  mode: 'home' | 'away' | 'last5' | 'general',
): Standing[] {
  const rows = new Map<string, Standing>();
  const finished = matches
    .filter(
      (m) =>
        m.competitionId === competitionId &&
        m.status === 'finished' &&
        m.homeScore !== null &&
        m.awayScore !== null,
    )
    .sort((a, b) => b.kickoff.localeCompare(a.kickoff));
  for (const m of finished)
    for (const [id, home] of [
      [m.homeId, true],
      [m.awayId, false],
    ] as const) {
      if ((mode === 'home' && !home) || (mode === 'away' && home)) continue;
      const row = rows.get(id) ?? {
        teamId: id,
        position: 0,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        scored: 0,
        conceded: 0,
        points: 0,
        form: [],
      };
      if (mode === 'last5' && row.played >= 5) continue;
      const gf = home ? m.homeScore! : m.awayScore!,
        ga = home ? m.awayScore! : m.homeScore!;
      row.played++;
      row.scored += gf;
      row.conceded += ga;
      if (gf > ga) {
        row.won++;
        row.points += 3;
      } else if (gf === ga) {
        row.drawn++;
        row.points++;
      } else row.lost++;
      if (row.form.length < 5) row.form.push(gf > ga ? 'V' : gf === ga ? 'N' : 'D');
      rows.set(id, row);
    }
  return [...rows.values()]
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.scored - b.conceded - (a.scored - a.conceded) ||
        b.scored - a.scored ||
        a.teamId.localeCompare(b.teamId),
    )
    .map((r, i) => ({ ...r, position: i + 1 }));
}
