import type { Match } from '@/types/football';
import {
  resultAvailable,
  resultAt,
  theoreticalResultTime,
  type AvailabilityMode,
} from './availability';
import { regulationResult } from './result-period';
export const initialElo = 1500;
export function updateElo(
  home: number,
  away: number,
  homeGoals: number,
  awayGoals: number,
  advantage = 60,
  k = 24,
) {
  if (
    ![home, away, homeGoals, awayGoals, advantage, k].every(Number.isFinite) ||
    homeGoals < 0 ||
    awayGoals < 0
  )
    throw new Error('INVALID_ELO_INPUT');
  const expected = 1 / (1 + 10 ** ((away - home - advantage) / 400));
  const result = homeGoals > awayGoals ? 1 : homeGoals === awayGoals ? 0.5 : 0;
  const margin = Math.log(Math.abs(homeGoals - awayGoals) + 1) + 1;
  const change = k * margin * (result - expected);
  return { home: home + change, away: away - change };
}
export function eloHistory(
  matches: Match[],
  cutoff: string,
  advantage = 60,
  mode: AvailabilityMode = 'observed',
) {
  let ratings = new Map<string, number>();
  const known = new Map<string, Match>();
  const before = new Map<string, number>();
  const after = new Map<string, number>();
  const events: { at: number; type: 'kickoff' | 'result'; match: Match }[] = [];
  for (const match of matches) {
    if (Date.parse(match.kickoff) < Date.parse(cutoff))
      events.push({ at: Date.parse(match.kickoff), type: 'kickoff', match });
    const revisions = match.resultRevisions?.length
      ? match.resultRevisions.map((r) => ({ ...match, ...r, resultObservedAt: r.observedAt }))
      : [match];
    for (const revision of revisions) {
      const at = revision.resultObservedAt
        ? Date.parse(revision.resultObservedAt)
        : mode === 'reconstructed' || revision.source === 'demo'
          ? theoreticalResultTime(revision)
          : NaN;
      if (Number.isFinite(at) && at > Date.parse(revision.kickoff) && at < Date.parse(cutoff))
        events.push({ at, type: 'result', match: revision });
    }
  }
  events.sort(
    (a, b) =>
      a.at - b.at ||
      (a.type === b.type ? a.match.id.localeCompare(b.match.id) : a.type === 'kickoff' ? -1 : 1),
  );
  let lastKickoff = -Infinity;
  const apply = (m: Match) => {
    const h = ratings.get(m.homeId) ?? initialElo,
      a = ratings.get(m.awayId) ?? initialElo;
    const updated = updateElo(
      h,
      a,
      m.homeScore!,
      m.awayScore!,
      m.neutralVenue === true ? 0 : advantage,
    );
    ratings.set(m.homeId, updated.home);
    ratings.set(m.awayId, updated.away);
    after.set(`${m.id}:${m.homeId}`, updated.home);
    after.set(`${m.id}:${m.awayId}`, updated.away);
  };
  for (const event of events) {
    const m = event.match;
    if (event.type === 'kickoff') {
      before.set(`${m.id}:${m.homeId}`, ratings.get(m.homeId) ?? initialElo);
      before.set(`${m.id}:${m.awayId}`, ratings.get(m.awayId) ?? initialElo);
      continue;
    }
    const result = regulationResult(m, mode === 'reconstructed');
    const changed = known.has(m.id);
    if (result) known.set(m.id, result);
    else known.delete(m.id);
    // Chronological re-fold on late observations/corrections. Historical kickoff
    // snapshots above remain what was actually known then, not a revised past.
    if (changed || Date.parse(m.kickoff) < lastKickoff || !result) {
      ratings = new Map();
      after.clear();
      lastKickoff = -Infinity;
      for (const row of [...known.values()].sort(
        (a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff) || a.id.localeCompare(b.id),
      )) {
        apply(row);
        lastKickoff = Date.parse(row.kickoff);
      }
    } else {
      apply(result);
      lastKickoff = Date.parse(result.kickoff);
    }
  }
  const history = [...matches]
    .sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff) || a.id.localeCompare(b.id))
    .flatMap((m) => {
      const available = resultAt(m, cutoff, mode);
      if (!available || !resultAvailable(m, cutoff, mode)) return [];
      return [m.homeId, m.awayId].map((teamId) => ({
        teamId,
        matchId: m.id,
        before: before.get(`${m.id}:${teamId}`) ?? initialElo,
        after: after.get(`${m.id}:${teamId}`) ?? initialElo,
        at: available.resultObservedAt ?? new Date(theoreticalResultTime(available)).toISOString(),
      }));
    });
  return { ratings, history };
}
