import type { Match } from '@/types/football';
/** Opponent strength is the rating known before each historical match. */
export function formIndex(
  teamId: string,
  matches: Match[],
  cutoff: string,
  before: Map<string, number>,
  halfLifeDays = 30,
  advantage = 60,
): number | null {
  const eligible = matches
    .filter(
      (m) =>
        m.status === 'finished' &&
        m.homeScore !== null &&
        m.awayScore !== null &&
        (m.homeId === teamId || m.awayId === teamId) &&
        Date.parse(m.kickoff) + 10800000 < Date.parse(cutoff),
    )
    .sort((a, b) => b.kickoff.localeCompare(a.kickoff))
    .slice(0, 10);
  if (eligible.length < 5) return null;
  let total = 0,
    weight = 0;
  for (const m of eligible) {
    const home = m.homeId === teamId,
      opponent = home ? m.awayId : m.homeId;
    const own = before.get(`${m.id}:${teamId}`) ?? 1500,
      other = before.get(`${m.id}:${opponent}`) ?? 1500;
    const expected = 1 / (1 + 10 ** ((other - own - (home ? advantage : -advantage)) / 400));
    const gf = home ? m.homeScore! : m.awayScore!,
      ga = home ? m.awayScore! : m.homeScore!;
    const result = gf > ga ? 1 : gf === ga ? 0.5 : 0;
    const w = 0.5 ** ((Date.parse(cutoff) - Date.parse(m.kickoff)) / 86400000 / halfLifeDays);
    total += (0.5 + (result - expected) / 2) * w;
    weight += w;
  }
  return Math.max(0, Math.min(100, (total / weight) * 100));
}
