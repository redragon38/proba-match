import type { Dataset, Match, MatchStatus } from '@/types/football';
import { observeResult } from '@/prediction-engine/availability';
import type { FotmobListedMatch } from './providers/fotmob';

/** Fast polling stays at eight hours; daily recovery covers at most ten UTC dates. */
export function fotmobLiveSelection(data: Pick<Dataset, 'matches'>, now: Date, catchUp = false) {
  const from = now.getTime() - (catchUp ? 7 * 24 : 8) * 3600_000;
  const until = now.getTime() + 36 * 3600_000;
  return data.matches.filter((match) => {
    const kickoff = Date.parse(match.kickoff);
    return (
      ['live', 'scheduled'].includes(match.status) &&
      Number.isFinite(kickoff) &&
      kickoff >= from &&
      kickoff <= until
    );
  });
}
function state(row: FotmobListedMatch): MatchStatus {
  if (row.status.cancelled)
    return /postpon/i.test(row.status.reason?.short ?? '') ? 'postponed' : 'cancelled';
  if (row.status.finished) return 'finished';
  if (row.status.ongoing || row.status.started) return 'live';
  return 'scheduled';
}
export function applyFotmobListing(match: Match, row: FotmobListedMatch, observedAt: string) {
  const status = state(row);
  if (match.status === 'finished' && status !== 'finished') return match;
  const scored = status === 'live' || status === 'finished';
  const period: Match['resultPeriod'] = /^FT$/i.test(row.status.reason?.short ?? '')
    ? 'regulation'
    : 'unknown';
  const minute = String(row.status.liveTime?.short ?? '').match(/\d{1,3}/);
  return observeResult(
    {
      ...match,
      status,
      source: 'fotmob',
      provenance: { schedule: match.provenance?.schedule ?? match.source, details: 'fotmob' },
      homeScore: scored ? (row.home.score ?? null) : null,
      awayScore: scored ? (row.away.score ?? null) : null,
      // Only an explicit FT marker certifies regulation; an unqualified final does not.
      resultPeriod: status === 'finished' ? period : match.resultPeriod,
      scoreBreakdown:
        status === 'finished'
          ? period === 'regulation'
            ? { fulltime: { home: row.home.score, away: row.away.score } }
            : undefined
          : match.scoreBreakdown,
      minute: status === 'live' && minute ? Math.min(Number(minute[0]), 130) : null,
      phase:
        status === 'live'
          ? /^(HT|HALF)/i.test(String(row.status.liveTime?.short ?? ''))
            ? 'halftime'
            : 'playing'
          : undefined,
      updatedAt: observedAt,
    },
    match,
    observedAt,
  );
}
