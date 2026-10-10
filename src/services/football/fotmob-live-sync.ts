import { db } from '@/database/client';
import { observeResult } from '@/prediction-engine/availability';
import type { MatchStatus } from '@/types/football';
import { bindIdentity } from './identities';
import { footballJob } from './jobs';
import { readLocalDataset } from './local-store';
import { persistMatchDetails } from './persistence';
import { FotmobProvider, identifyFotmobFixture, type FotmobListedMatch } from './providers/fotmob';

function state(row: FotmobListedMatch): MatchStatus {
  if (row.status.cancelled) {
    return /postpon/i.test(row.status.reason?.short ?? '') ? 'postponed' : 'cancelled';
  }
  if (row.status.finished) return 'finished';
  if (row.status.ongoing || row.status.started) return 'live';
  return 'scheduled';
}

function liveMinute(row: FotmobListedMatch) {
  if (!(row.status.ongoing || row.status.started) || row.status.finished) return null;
  const match = String(row.status.liveTime?.short ?? '').match(/\d{1,3}/);
  return match ? Math.min(Number(match[0]), 130) : null;
}

function livePhase(row: FotmobListedMatch) {
  return /^(HT|HALF)/i.test(String(row.status.liveTime?.short ?? ''))
    ? ('halftime' as const)
    : ('playing' as const);
}

/** Refresh only fixtures around the current match window: one listing request per UTC date. */
export async function syncFotmobLive(now = new Date()) {
  return footballJob('fotmob-live', async () => {
    const data = await readLocalDataset();
    const from = now.getTime() - 8 * 3600_000;
    const until = now.getTime() + 36 * 3600_000;
    const selected = data.matches.filter((match) => {
      const kickoff = Date.parse(match.kickoff);
      return (
        match.status === 'live' ||
        (Number.isFinite(kickoff) &&
          kickoff >= from &&
          kickoff <= until &&
          match.status === 'scheduled')
      );
    });
    if (!selected.length)
      return { status: 'success', matches: 0, selected: 0, requests: 0, unmatched: 0 };

    const provider = new FotmobProvider();
    const mapped = new Map(
      (
        await db.footballIdentity.findMany({
          where: { provider: 'fotmob', kind: 'match', entityId: { in: selected.map((m) => m.id) } },
          select: { externalId: true, entityId: true },
        })
      ).map((row) => [row.entityId, row.externalId]),
    );
    const dates = new Set(selected.map((match) => match.kickoff.slice(0, 10).replaceAll('-', '')));
    const listings = new Map<string, FotmobListedMatch[]>();
    for (const date of dates) listings.set(date, await provider.matches(date));

    const changed = new Set<string>();
    let unmatched = 0;
    const observedAt = new Date().toISOString();
    for (const match of selected) {
      const rows = listings.get(match.kickoff.slice(0, 10).replaceAll('-', '')) ?? [];
      let row = rows.find((candidate) => String(candidate.id) === mapped.get(match.id));
      const home = data.teams.find((team) => team.id === match.homeId);
      const away = data.teams.find((team) => team.id === match.awayId);
      if (!row && home && away)
        row =
          identifyFotmobFixture(rows, {
            kickoff: match.kickoff,
            homeName: home.name,
            awayName: away.name,
          }) ?? undefined;
      if (!row || !home || !away) {
        unmatched++;
        continue;
      }
      if (!mapped.has(match.id)) {
        await bindIdentity(
          'fotmob',
          'match',
          String(row.id),
          match.id,
          `${home.name} / ${away.name}`,
        );
        await bindIdentity('fotmob', 'team', String(row.home.id), home.id, row.home.name);
        await bindIdentity('fotmob', 'team', String(row.away.id), away.id, row.away.name);
      }
      const nextStatus = state(row);
      // A delayed listing must never reopen a result already confirmed final.
      if (match.status === 'finished' && nextStatus !== 'finished') continue;
      const scored = nextStatus === 'live' || nextStatus === 'finished';
      const next = observeResult(
        {
          ...match,
          status: nextStatus,
          homeScore: scored ? (row.home.score ?? null) : null,
          awayScore: scored ? (row.away.score ?? null) : null,
          minute: nextStatus === 'live' ? liveMinute(row) : null,
          phase: nextStatus === 'live' ? livePhase(row) : undefined,
          updatedAt: observedAt,
        },
        match,
        observedAt,
      );
      if (
        next.status !== match.status ||
        next.homeScore !== match.homeScore ||
        next.awayScore !== match.awayScore ||
        next.minute !== match.minute
      ) {
        data.matches[data.matches.indexOf(match)] = next;
        changed.add(match.id);
      }
    }
    if (changed.size) {
      data.updatedAt = observedAt;
      await persistMatchDetails(data, changed, new Set());
    }
    return {
      status: 'success',
      matches: changed.size,
      selected: selected.length,
      requests: provider.requests,
      unmatched,
    };
  });
}
