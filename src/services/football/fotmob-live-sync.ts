import { db } from '@/database/client';
import { setTimeout as pause } from 'node:timers/promises';
import { applyFotmobListing, fotmobLiveSelection } from './fotmob-live-state';
import { bindIdentity } from './identities';
import { footballJob } from './jobs';
import { readLocalDataset } from './local-store';
import { persistMatchDetails } from './persistence';
import { rebuildElo } from './rebuild-elo';
import { persistPredictions } from '@/services/predictions';
import { FotmobProvider, identifyFotmobFixture, type FotmobListedMatch } from './providers/fotmob';

/** Refresh only fixtures around the current match window: one listing request per UTC date. */
export async function syncFotmobLive(now = new Date(), options: { catchUp?: boolean } = {}) {
  return footballJob('fotmob-live', async () => {
    const data = await readLocalDataset();
    const selected = fotmobLiveSelection(data, now, options.catchUp);
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
    for (const date of dates) {
      if (listings.size) await pause(500);
      listings.set(date, await provider.matches(date));
    }

    const changed = new Set<string>();
    let unmatched = 0,
      resultsChanged = 0;
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
      const next = applyFotmobListing(match, row, observedAt);
      if (
        next.status !== match.status ||
        next.homeScore !== match.homeScore ||
        next.awayScore !== match.awayScore ||
        next.minute !== match.minute ||
        next.phase !== match.phase
      ) {
        data.matches[data.matches.indexOf(match)] = next;
        changed.add(match.id);
        if (match.status === 'finished' || next.status === 'finished') resultsChanged++;
      }
    }
    if (changed.size) {
      data.updatedAt = observedAt;
      if (resultsChanged) data.verifiedAt = { ...data.verifiedAt, results: observedAt };
      await persistMatchDetails(data, changed, new Set());
      if (resultsChanged) {
        await rebuildElo();
        await persistPredictions(data);
      }
    }
    return {
      status: unmatched ? 'partial' : 'success',
      matches: changed.size,
      selected: selected.length,
      requests: provider.requests,
      unmatched,
      resultsChanged,
    };
  });
}
