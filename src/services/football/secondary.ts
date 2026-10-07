import { db } from '@/database/client';
import { log } from '@/lib/logger';
import { ApiFootballProvider } from './providers/apiFootball';
import { identity, bindIdentity, resolveIdentity } from './identities';
import { canonicalTeam } from './providers/openfootball';
import { reserveQuota } from './quota';
import { readLocalDataset, readLocalHistory } from './local-store';
import { footballJob } from './jobs';
import { mergeDetailRevisions } from './detail-revisions';
import { persistDataset } from './persistence';
import { persistPredictions } from '@/services/predictions';
import { rebuildElo } from './rebuild-elo';
import type { Dataset, Match } from '@/types/football';
import { derivedStandings } from '@/services/derived-standings';
import { matchQualityIssues } from './match-quality';
import { addObservedPlayerProfiles } from './match-profiles';

const secondaryWarning =
  'Certaines statistiques live peuvent être temporairement indisponibles. Les dernières données locales restent disponibles.';
/** Only completed results contribute to chronological Elo and standings. */
export function affectsResults(before: Match, after: Match) {
  return (
    (before.status === 'finished' || after.status === 'finished') &&
    (before.status !== after.status ||
      before.homeScore !== after.homeScore ||
      before.awayScore !== after.awayScore ||
      before.kickoff !== after.kickoff)
  );
}
export function affectsPredictions(before: Match, after: Match) {
  return (
    affectsResults(before, after) ||
    (after.status === 'scheduled' &&
      (before.status !== after.status ||
        before.kickoff !== after.kickoff ||
        JSON.stringify(before.lineups) !== JSON.stringify(after.lineups)))
  );
}

export function secondaryDue(m: Match, now = Date.now()) {
  const until = Date.parse(m.kickoff) - now;
  const age = now - Date.parse(m.detailsUpdatedAt ?? '1970-01-01');
  if (m.status === 'live') return age >= 60000;
  if (m.status === 'finished')
    return until > -2 * 86400000 && (!m.detailsUpdatedAt || (age >= 3600000 && until > -86400000));
  if (m.status !== 'scheduled' || m.kickoffKnown === false) return false;
  if (until < -6 * 3600000 || until > 3600000) return false;
  return age >= (until > 0 ? 300000 : 60000);
}
export function secondaryProvider(reserve: () => Promise<void>) {
  if (!process.env.FOOTBALL_API_KEY) return null;
  if ((process.env.FOOTBALL_API_PROVIDER ?? 'api-football') !== 'api-football')
    throw new Error('UNSUPPORTED_SECONDARY_PROVIDER');
  return new ApiFootballProvider(process.env.FOOTBALL_API_KEY, reserve);
}
async function mapTeam(data: Dataset, externalId: string, name: string, competitionId: string) {
  const prior = await identity('api-football', 'team', externalId);
  if (prior) return prior.entityId;
  const candidates = data.teams.filter(
    (t) => t.competitionId === competitionId && canonicalTeam(t.name) === canonicalTeam(name),
  );
  if (candidates.length === 1) {
    await bindIdentity('api-football', 'team', externalId, candidates[0].id, name);
    return candidates[0].id;
  }
  const id = `api-football:team:${externalId}`;
  await db.mappingIssue.upsert({
    where: { id },
    create: {
      id,
      provider: 'api-football',
      kind: 'team',
      externalId,
      externalName: name,
      candidates: candidates.map((t) => t.id),
    },
    update: { candidates: candidates.map((t) => t.id), resolvedAt: null },
  });
  log('TEAM_MAPPING_REQUIRED', { code: candidates.length ? 'AMBIGUOUS_TEAM' : 'UNKNOWN_TEAM' });
  return null;
}
export async function syncSecondary(options: { date?: string; enrich?: boolean } = {}) {
  if (!process.env.FOOTBALL_API_KEY) return { status: 'disabled', matches: 0, requests: 0 };
  return footballJob('api-football', async () => {
    const data = await readLocalDataset();
    if (!data.matches.length) return { status: 'awaiting_openfootball', matches: 0, requests: 0 };
    let requests = 0,
      priority: 'live' | 'normal' = 'normal',
      failures = 0;
    const provider = secondaryProvider(async () => {
      await reserveQuota(priority);
      requests++;
    })!;
    const now = Date.now();
    const relevant = data.matches
      .filter(
        (m) => secondaryDue(m, now) && (!options.date || m.kickoff.slice(0, 10) === options.date),
      )
      .sort(
        (a, b) =>
          Number(b.status === 'live') - Number(a.status === 'live') ||
          b.kickoff.localeCompare(a.kickoff),
      );
    const changed = new Set<string>();
    const resultCompetitions = new Set<string>();
    let predictionChanged = false;
    const injuryTeamIds = new Set<string>();
    const matched = new Map<string, string>();
    let detailAttempted = false;
    let detailCache:
      | {
          externalId: string;
          key: string;
          fields: {
            payload: { complete: boolean };
            expiresAt: Date;
            staleUntil: Date;
          };
        }
      | undefined;
    try {
      for (const m of relevant) {
        const alias = await db.footballIdentity.findFirst({
          where: { provider: 'api-football', kind: 'match', entityId: m.id },
        });
        if (alias) {
          matched.set(alias.externalId, m.id);
          continue;
        }
        // Discover only missing external IDs near kickoff, never complete historical schedules.
        if (Date.parse(m.kickoff) < now - 86400000) continue;
        const league = await db.footballIdentity.findFirst({
          where: { provider: 'api-football', kind: 'competition', entityId: m.competitionId },
        });
        if (!league) continue;
        const date = m.kickoff.slice(0, 10),
          key = `secondary:discovery:${league.externalId}:${date}`;
        const check = await db.cacheEntry.findUnique({ where: { key } });
        if (check && check.expiresAt.getTime() > now) continue;
        priority = m.status === 'live' || Date.parse(m.kickoff) <= now ? 'live' : 'normal';
        const batch = await provider.discover(league.externalId, date);
        for (const external of batch.matches) {
          const ht = batch.teams.find((t) => t.id === external.homeId),
            at = batch.teams.find((t) => t.id === external.awayId);
          if (!ht || !at) continue;
          const homeId = await mapTeam(data, ht.id, ht.name, m.competitionId);
          const awayId = await mapTeam(data, at.id, at.name, m.competitionId);
          if (!homeId || !awayId) continue;
          const candidates = data.matches.filter(
            (local) =>
              local.competitionId === m.competitionId &&
              local.homeId === homeId &&
              local.awayId === awayId &&
              (local.season ?? 0) === (m.season ?? 0),
          );
          if (candidates.length !== 1) {
            log('TEAM_MAPPING_REQUIRED', { code: 'AMBIGUOUS_MATCH' });
            continue;
          }
          await bindIdentity('api-football', 'match', external.id, candidates[0].id);
          if (relevant.some((r) => r.id === candidates[0].id))
            matched.set(external.id, candidates[0].id);
        }
        const fields = {
          payload: {},
          expiresAt: new Date(now + 3600000),
          staleUntil: new Date(now + 3600000),
        };
        await db.cacheEntry.upsert({ where: { key }, create: { key, ...fields }, update: fields });
      }
      const ids = [...matched.keys()];
      for (let i = 0; i < ids.length; i += 20) {
        const chunk = ids.slice(i, i + 20);
        priority = chunk.some((id) => {
          const m = data.matches.find((m) => m.id === matched.get(id))!;
          return m.status === 'live' || Date.parse(m.kickoff) <= now;
        })
          ? 'live'
          : 'normal';
        let detailedId: string | undefined;
        if (!detailAttempted) {
          const eligible = chunk.filter((id) => {
            const match = data.matches.find((row) => row.id === matched.get(id));
            return (
              match &&
              (match.status === 'live' ||
                match.status === 'finished' ||
                (match.status === 'scheduled' && Date.parse(match.kickoff) - now < 2 * 3600000))
            );
          });
          if (eligible.length) {
            const cached = await db.cacheEntry.findMany({
              where: { key: { in: eligible.map((id) => `secondary:fixture-details:${id}`) } },
              select: { key: true, expiresAt: true },
            });
            const fresh = new Set(
              cached.filter((entry) => entry.expiresAt.getTime() > now).map((entry) => entry.key),
            );
            detailedId = eligible.find((id) => !fresh.has(`secondary:fixture-details:${id}`));
          }
        }
        if (detailedId) detailAttempted = true;
        const batch = await provider.details(chunk, detailedId ? [detailedId] : []);
        if (detailedId) {
          const match = data.matches.find((row) => row.id === matched.get(detailedId))!;
          const complete = batch.enriched.includes(detailedId);
          if (!complete) failures++;
          const ttl = !complete
            ? 10 * 60000
            : match.status === 'live'
              ? 20 * 60000
              : match.status === 'finished'
                ? 24 * 3600000
                : 15 * 60000;
          const key = `secondary:fixture-details:${detailedId}`;
          const fields = {
            payload: { complete },
            expiresAt: new Date(now + ttl),
            staleUntil: new Date(now + ttl),
          };
          detailCache = { externalId: detailedId, key, fields };
        }
        for (const ext of batch.matches) {
          const local = data.matches.find((m) => m.id === matched.get(ext.id));
          if (!local) continue;
          const home = await identity('api-football', 'team', ext.homeId),
            away = await identity('api-football', 'team', ext.awayId);
          if (home?.entityId !== local.homeId || away?.entityId !== local.awayId) {
            log('SYNC_MATCH_FAILED', { code: 'TEAM_MISMATCH' });
            continue;
          }
          const team = (id: string) =>
            id === ext.homeId ? local.homeId : id === ext.awayId ? local.awayId : undefined;
          const playerIds = new Map<string, string>();
          for (const p of [
            ...ext.lineups.flatMap((l) => [...l.starters, ...l.substitutes]),
            ...(ext.performances ?? []).map((p) => ({ id: p.playerId, name: p.name })),
          ]) {
            if (!playerIds.has(p.id))
              playerIds.set(
                p.id,
                await resolveIdentity('api-football', 'player', p.id, p.name, []),
              );
          }
          const merged: Match = {
            ...local,
            ...ext,
            id: local.id,
            slug: local.slug,
            competitionId: local.competitionId,
            homeId: local.homeId,
            awayId: local.awayId,
            season: local.season,
            scoreBreakdown: ext.scoreBreakdown ?? local.scoreBreakdown,
            kickoffKnown: true,
            events: ext.events.length
              ? ext.events
                  .filter((e) => team(e.teamId))
                  .map((e) => ({ ...e, teamId: team(e.teamId)! }))
              : local.events,
            lineups: ext.lineups
              .filter((l) => team(l.teamId))
              .map((l) => ({
                ...l,
                teamId: team(l.teamId)!,
                starters: l.starters.map((p) => ({ ...p, id: playerIds.get(p.id)! })),
                substitutes: l.substitutes.map((p) => ({ ...p, id: playerIds.get(p.id)! })),
              })),
            performances: ext.performances
              ?.filter((p) => team(p.teamId))
              .map((p) => ({
                ...p,
                playerId: playerIds.get(p.playerId)!,
                teamId: team(p.teamId)!,
              })),
            provenance: {
              schedule: local.provenance?.schedule ?? local.source,
              details: 'api-football',
            },
          };
          Object.assign(merged, mergeDetailRevisions(local, merged));
          addObservedPlayerProfiles(data, merged);
          for (const issue of matchQualityIssues(merged, data.players)) log(issue);
          for (const external of batch.teams) {
            const internal = team(external.id);
            const index = data.teams.findIndex((t) => t.id === internal);
            if (index >= 0 && external.logo)
              data.teams[index] = { ...data.teams[index], logo: external.logo };
          }
          if (affectsResults(local, merged)) resultCompetitions.add(local.competitionId);
          predictionChanged ||= affectsPredictions(local, merged);
          data.matches[data.matches.indexOf(local)] = merged;
          changed.add(local.id);
        }
      }
      if (options.enrich) {
        priority = 'normal';
        for (const t of data.teams) {
          const alias = await db.footballIdentity.findFirst({
            where: { provider: 'api-football', kind: 'team', entityId: t.id },
          });
          const competition = data.competitions.find((c) => c.id === t.competitionId);
          const compAlias = await db.footballIdentity.findFirst({
            where: { provider: 'api-football', kind: 'competition', entityId: t.competitionId },
          });
          if (!alias || !competition || !compAlias) continue;
          const key = `secondary:players:${t.id}:${competition.season}`;
          const prior = await db.cacheEntry.findUnique({ where: { key } });
          if (prior && prior.expiresAt.getTime() > now) continue;
          const rows = await provider.players(
            alias.externalId,
            competition.season,
            compAlias.externalId,
          );
          if (rows.length) {
            const fallback = data.players.filter(
              (player) => player.teamId === t.id && player.source === 'thesportsdb',
            );
            data.players = data.players.filter(
              (player) => player.teamId !== t.id || player.source !== 'thesportsdb',
            );
            if (fallback.length)
              await db.searchIndex.deleteMany({
                where: { id: { in: fallback.map((player) => `player:${player.id}`) } },
              });
          }
          for (const p of rows) {
            const id = await resolveIdentity('api-football', 'player', p.id, p.name, []);
            const old = data.players.find((p) => p.id === id);
            const value = {
              ...p,
              id,
              slug: old?.slug ?? `${p.slug}-${id.slice(0, 8)}`,
              teamId: t.id,
              statsScope: p.statsScope
                ? { ...p.statsScope, teamId: t.id, competitionId: competition.id }
                : undefined,
              source: 'api-football' as const,
            };
            data.players = [...data.players.filter((p) => p.id !== id), value];
          }
          const fields = {
            payload: {},
            expiresAt: new Date(now + 6 * 3600000),
            staleUntil: new Date(now + 86400000),
          };
          await db.cacheEntry.upsert({
            where: { key },
            create: { key, ...fields },
            update: fields,
          });
        }
        for (const c of data.competitions) {
          const alias = await db.footballIdentity.findFirst({
            where: { provider: 'api-football', kind: 'competition', entityId: c.id },
          });
          if (!alias) continue;
          const key = `secondary:injuries:${c.id}`,
            prior = await db.cacheEntry.findUnique({ where: { key } });
          if (prior && prior.expiresAt.getTime() > now) continue;
          const injuries = await provider.injuries(alias.externalId, c.season);
          const mapped = [];
          for (const injury of injuries) {
            const team = await identity('api-football', 'team', injury.teamId);
            const player = await identity('api-football', 'player', injury.playerId);
            if (team && player && data.players.some((p) => p.id === player.entityId))
              mapped.push({
                ...injury,
                id: `secondary-${injury.id}`,
                teamId: team.entityId,
                playerId: player.entityId,
              });
          }
          const teams = new Set(
            data.teams.filter((t) => t.competitionId === c.id).map((t) => t.id),
          );
          for (const id of teams) injuryTeamIds.add(id);
          data.injuries = [...data.injuries.filter((i) => !teams.has(i.teamId)), ...mapped];
          const fields = {
            payload: {},
            expiresAt: new Date(now + 6 * 3600000),
            staleUntil: new Date(now + 86400000),
          };
          await db.cacheEntry.upsert({
            where: { key },
            create: { key, ...fields },
            update: fields,
          });
        }
      }
    } catch {
      failures++;
      log('SYNC_MATCH_FAILED', { code: 'SECONDARY_UNAVAILABLE' });
    }
    if (!requests && !failures) return { status: 'success', matches: 0, requests: 0 };
    data.updatedAt = new Date().toISOString();
    data.degraded = failures > 0;
    if (failures) data.warning = secondaryWarning;
    else if (data.warning === secondaryWarning) data.warning = undefined;
    for (const c of data.competitions) {
      if (resultCompetitions.has(c.id))
        data.standings[c.id] = derivedStandings(
          data.matches.filter((m) => m.season === c.season),
          c.id,
          'general',
        );
    }
    await persistDataset(data, changed, { injuryTeamIds: [...injuryTeamIds] });
    // A failed persistence must leave this fixture eligible for the next enrichment run.
    if (detailCache && changed.has(matched.get(detailCache.externalId)!)) {
      const { key, fields } = detailCache;
      await db.cacheEntry.upsert({ where: { key }, create: { key, ...fields }, update: fields });
    }
    if (predictionChanged) {
      const history = await readLocalHistory();
      if (resultCompetitions.size) await rebuildElo(history);
      await persistPredictions({ ...data, matches: history });
    }
    return { status: failures ? 'partial' : 'success', matches: changed.size, requests };
  });
}
