import { db as database } from '@/database/client';
import type { Prisma } from '@prisma/client';
import { fencePublication, assertJobActive } from './lease-context';
import type { Dataset, Match } from '@/types/football';
import { observeResult } from '@/prediction-engine/availability';
import { slugify } from '@/lib/format';
import { playerPerformance } from '@/prediction-engine/player';
const json = (value: unknown) => JSON.parse(JSON.stringify(value));
async function inBatches<T>(rows: T[], write: (row: T) => Promise<unknown>) {
  // Bound concurrent writes so remote PostgreSQL latency does not turn an import
  // into hours of serial round trips or exhaust the connection pool.
  for (let offset = 0; offset < rows.length; offset += 12)
    await Promise.all(rows.slice(offset, offset + 12).map(write));
}
async function persistDatasetTransaction(
  db: Prisma.TransactionClient,
  data: Dataset,
  changedIds: Set<string>,
  options: { profiles?: boolean; profileIds?: Set<string>; injuryTeamIds?: string[] } = {},
) {
  const observedAt = new Date().toISOString();
  // Also migrate existing results conservatively: first observation is NOW, not the kickoff.
  for (let offset = 0; offset < data.matches.length; offset += 500) {
    const chunk = data.matches.slice(offset, offset + 500);
    const priorRows = await db.match.findMany({
      where: { id: { in: chunk.map((m) => m.id) } },
      select: { id: true, payload: true },
    });
    const previous = new Map(priorRows.map((r) => [r.id, r.payload as unknown as Match]));
    for (let index = 0; index < chunk.length; index++) {
      const match = chunk[index];
      const observed = observeResult(match, previous.get(match.id), observedAt);
      if (
        observed.resultObservedAt !== previous.get(match.id)?.resultObservedAt ||
        JSON.stringify(observed.resultRevisions) !==
          JSON.stringify(previous.get(match.id)?.resultRevisions)
      )
        changedIds.add(match.id);
      data.matches[offset + index] = observed;
    }
  }
  for (const c of data.competitions) {
    const countryId = slugify(c.country) || 'international';
    await db.country.upsert({
      where: { id: countryId },
      create: { id: countryId, name: c.country },
      update: { name: c.country },
    });
    await db.competition.upsert({
      where: { id: c.id },
      create: { id: c.id, slug: c.slug, name: c.name, countryId, logo: c.logo },
      update: { name: c.name, logo: c.logo },
    });
    await db.season.upsert({
      where: { id: `${c.id}-${c.season}` },
      create: { id: `${c.id}-${c.season}`, competitionId: c.id, year: c.season },
      update: {},
    });
  }
  // Create each country once before parallel team writes (MLS also contains Canadian clubs).
  for (const country of new Set(data.teams.map((t) => t.country))) {
    const id = slugify(country) || 'international';
    await db.country.upsert({ where: { id }, create: { id, name: country }, update: {} });
  }
  await inBatches(data.teams, async (t) => {
    const countryId = slugify(t.country) || 'international';
    if (t.venue)
      await db.venue.upsert({
        where: { id: `team-${t.id}` },
        create: { id: `team-${t.id}`, name: t.venue },
        update: { name: t.venue },
      });
    if (t.coach)
      await db.coach.upsert({
        where: { id: `team-${t.id}` },
        create: { id: `team-${t.id}`, name: t.coach },
        update: { name: t.coach },
      });
    await db.team.upsert({
      where: { id: t.id },
      create: {
        id: t.id,
        slug: t.slug,
        name: t.name,
        countryId,
        logo: t.logo,
        venueId: t.venue ? `team-${t.id}` : null,
        coachId: t.coach ? `team-${t.id}` : null,
      },
      update: { name: t.name, logo: t.logo, countryId },
    });
  });
  for (const p of options.profiles === false
    ? []
    : data.players.filter((p) => !options.profileIds || options.profileIds.has(p.id))) {
    await db.player.upsert({
      where: { id: p.id },
      create: {
        id: p.id,
        slug: p.slug,
        name: p.name,
        teamId: p.teamId,
        position: p.position,
        number: p.number,
        nationality: p.nationality,
        photo: p.photo,
        birthDate: p.birthDate ? new Date(p.birthDate) : null,
      },
      update: {
        name: p.name,
        teamId: p.teamId,
        position: p.position,
        number: p.number,
        photo: p.photo,
      },
    });
    const t = data.teams.find((t) => t.id === p.teamId),
      c = data.competitions.find((c) => c.id === t?.competitionId);
    const observedAt = p.updatedAt ?? data.updatedAt;
    if (
      c &&
      p.statsScope?.verified === true &&
      p.statsScope.teamId === p.teamId &&
      p.statsScope.competitionId === c.id &&
      p.statsScope.season === c.season &&
      Object.values(p.stats).some((value) => value != null)
    )
      await db.playerStatistics.upsert({
        where: { id: `${p.id}-${c.id}-${c.season}-${observedAt}` },
        create: {
          id: `${p.id}-${c.id}-${c.season}-${observedAt}`,
          playerId: p.id,
          seasonId: `${c.id}-${c.season}`,
          asOf: new Date(observedAt),
          payload: json({ ...p.stats, scope: p.statsScope }),
        },
        update: { payload: json({ ...p.stats, scope: p.statsScope }) },
      });
  }
  const changedMatches = data.matches.filter((m) => changedIds.has(m.id));
  if (options.profiles === false) {
    // OpenFootball changes schedules and results only. Existing detail rows stay intact;
    // one PostgreSQL upsert per chunk avoids a transaction round trip per fixture.
    const competitions = new Map(
      data.competitions.map((competition) => [competition.id, competition]),
    );
    for (let offset = 0; offset < changedMatches.length; offset += 500) {
      const rows = changedMatches.slice(offset, offset + 500).flatMap((match) => {
        const competition = competitions.get(match.competitionId);
        return competition
          ? [
              {
                id: match.id,
                slug: match.slug,
                seasonId: `${competition.id}-${match.season ?? competition.season}`,
                homeId: match.homeId,
                awayId: match.awayId,
                kickoff: match.kickoff,
                status: match.status,
                homeScore: match.homeScore,
                awayScore: match.awayScore,
                minute: match.minute ?? null,
                referee: match.referee ?? null,
                source: match.source,
                payload: json(match),
              },
            ]
          : [];
      });
      if (!rows.length) continue;
      await db.$executeRaw`
        INSERT INTO "Match" ("id", "slug", "seasonId", "homeId", "awayId", "kickoff",
          "status", "homeScore", "awayScore", "minute", "referee", "source", "payload", "updatedAt")
        SELECT row."id", row."slug", row."seasonId", row."homeId", row."awayId", row."kickoff",
          row."status", row."homeScore", row."awayScore", row."minute", row."referee",
          row."source", row."payload", NOW() AT TIME ZONE 'UTC'
        FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS row(
          "id" text, "slug" text, "seasonId" text, "homeId" text, "awayId" text,
          "kickoff" timestamp(3), "status" text, "homeScore" integer, "awayScore" integer,
          "minute" integer, "referee" text, "source" text, "payload" jsonb)
        ON CONFLICT ("id") DO UPDATE SET
          "slug" = EXCLUDED."slug", "seasonId" = EXCLUDED."seasonId",
          "homeId" = EXCLUDED."homeId", "awayId" = EXCLUDED."awayId",
          "kickoff" = EXCLUDED."kickoff", "status" = EXCLUDED."status",
          "homeScore" = EXCLUDED."homeScore", "awayScore" = EXCLUDED."awayScore",
          "minute" = EXCLUDED."minute", "referee" = EXCLUDED."referee",
          "source" = EXCLUDED."source", "payload" = EXCLUDED."payload",
          "updatedAt" = EXCLUDED."updatedAt"
      `;
    }
  } else
    await inBatches(changedMatches, async (m) => {
      const comp = data.competitions.find((c) => c.id === m.competitionId);
      if (!comp) return;
      const fields = {
        slug: m.slug,
        seasonId: `${comp.id}-${m.season ?? comp.season}`,
        homeId: m.homeId,
        awayId: m.awayId,
        kickoff: new Date(m.kickoff),
        status: m.status,
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        minute: m.minute,
        referee: m.referee,
        source: m.source,
        payload: json(m),
      };
      {
        const tx = db;
        await tx.match.upsert({
          where: { id: m.id },
          create: { id: m.id, ...fields },
          update: fields,
        });
        await tx.matchEvent.deleteMany({ where: { matchId: m.id } });
        if (m.events.length)
          await tx.matchEvent.createMany({
            data: m.events.map((e, i) => ({
              id: `${m.id}-event-${i}`,
              matchId: m.id,
              teamId: e.teamId,
              minute: e.minute,
              extra: e.extra,
              type: e.type,
              payload: json(e),
            })),
          });
        // Remove withdrawn rows too: a cleared payload must not leave stale relations.
        await tx.matchLineup.deleteMany({
          where: { matchId: m.id, teamId: { notIn: m.lineups.map((l) => l.teamId) } },
        });
        await tx.matchPlayer.deleteMany({
          where: {
            matchId: m.id,
            playerId: { notIn: (m.performances ?? []).map((p) => p.playerId) },
          },
        });
        for (const l of m.lineups)
          await tx.matchLineup.upsert({
            where: { matchId_teamId: { matchId: m.id, teamId: l.teamId } },
            create: {
              id: `${m.id}-${l.teamId}`,
              matchId: m.id,
              teamId: l.teamId,
              formation: l.formation,
              confirmed: l.confirmed,
              publishedAt: new Date(
                m.detailObservedAt?.lineups ?? m.detailsUpdatedAt ?? m.updatedAt,
              ),
              payload: json(l),
            },
            update: {
              formation: l.formation,
              confirmed: l.confirmed,
              payload: json(l),
              ...(m.detailObservedAt?.lineups
                ? { publishedAt: new Date(m.detailObservedAt.lineups) }
                : {}),
            },
          });
        for (const p of m.performances ?? []) {
          await tx.player.upsert({
            where: { id: p.playerId },
            create: {
              id: p.playerId,
              slug: `${slugify(p.name)}-${p.playerId}`,
              name: p.name,
              teamId: p.teamId,
              position: p.position,
              number: p.number,
            },
            update: {},
          });
          const score = playerPerformance(p.stats, p.position);
          await tx.matchPlayer.upsert({
            where: { matchId_playerId: { matchId: m.id, playerId: p.playerId } },
            create: {
              id: `${m.id}-${p.playerId}`,
              matchId: m.id,
              playerId: p.playerId,
              minutes: p.stats.minutes,
              score,
              statistics: json(p.stats),
            },
            update: { minutes: p.stats.minutes, score, statistics: json(p.stats) },
          });
        }
      }
    });
  for (const [compId, rows] of Object.entries(data.standings)) {
    const comp = data.competitions.find((c) => c.id === compId);
    if (!comp) continue;
    await inBatches(rows, async (r) => {
      if (!data.teams.some((t) => t.id === r.teamId)) return;
      await db.standing.upsert({
        where: { id: `${compId}-${comp.season}-${r.teamId}` },
        create: {
          id: `${compId}-${comp.season}-${r.teamId}`,
          teamId: r.teamId,
          seasonId: `${compId}-${comp.season}`,
          position: r.position,
          points: r.points,
          payload: json(r),
        },
        update: { position: r.position, points: r.points, payload: json(r) },
      });
    });
  }
  if (options.injuryTeamIds?.length)
    await db.injury.deleteMany({
      where: {
        teamId: { in: options.injuryTeamIds },
        id: { notIn: data.injuries.map((i) => i.id) },
      },
    });
  for (const i of options.profiles === false ? [] : data.injuries) {
    if (!data.players.some((p) => p.id === i.playerId)) continue;
    await db.injury.upsert({
      where: { id: i.id },
      create: { ...i, asOf: new Date(data.updatedAt) },
      update: { reason: i.reason, status: i.status, asOf: new Date(data.updatedAt) },
    });
  }
  const searchRows = [
    ...data.teams.map((t) => ({
      id: `team:${t.id}`,
      entityType: 'team',
      entityId: t.id,
      title: t.name,
      normalized: slugify(t.name),
      href: `/equipe/${t.slug}`,
    })),
    ...data.players.map((p) => ({
      id: `player:${p.id}`,
      entityType: 'player',
      entityId: p.id,
      title: p.name,
      normalized: slugify(p.name),
      href: `/joueur/${p.slug}`,
    })),
    ...data.competitions.map((c) => ({
      id: `competition:${c.id}`,
      entityType: 'competition',
      entityId: c.id,
      title: c.name,
      normalized: slugify(c.name),
      href: `/competition/${c.slug}`,
    })),
  ];
  await inBatches(searchRows, (row) =>
    db.searchIndex.upsert({ where: { id: row.id }, create: row, update: row }),
  );
  // Append-only source observations survive later payload/snapshot rewrites.
  for (const m of changedMatches) {
    if (!m.resultRevisions?.length) continue;
    await db.resultObservation.createMany({
      data: m.resultRevisions.map((r, index) => ({
        id: `${m.id}:${r.observedAt}:${index}`,
        matchId: m.id,
        receivedAt: new Date(r.observedAt),
        source: r.source,
        payload: json(r),
      })),
      skipDuplicates: true,
    });
  }
  data.verifiedAt = {
    ...data.verifiedAt,
    ...(changedMatches.length ? { calendar: observedAt, results: observedAt } : {}),
    ...(options.profileIds?.size ? { players: observedAt } : {}),
  };
  await fencePublication(db);
  await db.cacheEntry.upsert({
    where: { key: 'football:dataset' },
    create: {
      key: 'football:dataset',
      payload: json(data),
      expiresAt: new Date(
        Date.now() +
          (data.source !== 'api-football' && data.source !== 'demo' ? 7 * 3600_000 : 120_000),
      ),
      staleUntil: new Date(Date.now() + 7 * 86400_000),
    },
    update: {
      payload: json(data),
      expiresAt: new Date(
        Date.now() +
          (data.source !== 'api-football' && data.source !== 'demo' ? 7 * 3600_000 : 120_000),
      ),
      staleUntil: new Date(Date.now() + 7 * 86400_000),
    },
  });
}

/** One generation publishes atomically across relations, observations and snapshot. */
export async function persistDataset(
  data: Dataset,
  changedIds: Set<string>,
  options: { profiles?: boolean; profileIds?: Set<string>; injuryTeamIds?: string[] } = {},
) {
  assertJobActive();
  const working = structuredClone(data);
  await database.$transaction((tx) => persistDatasetTransaction(tx, working, changedIds, options), {
    maxWait: 10_000,
    timeout: 30 * 60_000,
  });
  Object.assign(data, working); // Do not expose the new generation before its commit.
}

/** Publish roster profiles without rewriting the complete fixture dataset. */
export async function persistPlayerProfiles(data: Dataset, profileIds: Set<string>) {
  assertJobActive();
  const working = structuredClone(data);
  const players = working.players.filter((player) => profileIds.has(player.id));
  const observedAt = new Date().toISOString();

  await database.$transaction(
    async (tx) => {
      await inBatches(players, async (player) => {
        await tx.player.upsert({
          where: { id: player.id },
          create: {
            id: player.id,
            slug: player.slug,
            name: player.name,
            teamId: player.teamId,
            position: player.position,
            number: player.number,
            nationality: player.nationality,
            photo: player.photo,
            birthDate: player.birthDate ? new Date(player.birthDate) : null,
          },
          update: {
            slug: player.slug,
            name: player.name,
            teamId: player.teamId,
            position: player.position,
            number: player.number,
            nationality: player.nationality,
            photo: player.photo,
            birthDate: player.birthDate ? new Date(player.birthDate) : null,
          },
        });

        const team = working.teams.find((row) => row.id === player.teamId);
        const competition = working.competitions.find((row) => row.id === team?.competitionId);
        const asOf = player.updatedAt ?? working.updatedAt;
        if (
          competition &&
          player.statsScope?.verified === true &&
          player.statsScope.teamId === player.teamId &&
          player.statsScope.competitionId === competition.id &&
          player.statsScope.season === competition.season &&
          Object.values(player.stats).some((value) => value != null)
        )
          await tx.playerStatistics.upsert({
            where: { id: `${player.id}-${competition.id}-${competition.season}-${asOf}` },
            create: {
              id: `${player.id}-${competition.id}-${competition.season}-${asOf}`,
              playerId: player.id,
              seasonId: `${competition.id}-${competition.season}`,
              asOf: new Date(asOf),
              payload: json({ ...player.stats, scope: player.statsScope }),
            },
            update: { payload: json({ ...player.stats, scope: player.statsScope }) },
          });

        const searchRow = {
          id: `player:${player.id}`,
          entityType: 'player',
          entityId: player.id,
          title: player.name,
          normalized: slugify(player.name),
          href: `/joueur/${player.slug}`,
        };
        await tx.searchIndex.upsert({
          where: { id: searchRow.id },
          create: searchRow,
          update: searchRow,
        });
      });

      working.verifiedAt = { ...working.verifiedAt, players: observedAt };
      await fencePublication(tx);
      await tx.cacheEntry.upsert({
        where: { key: 'football:dataset' },
        create: {
          key: 'football:dataset',
          payload: json(working),
          expiresAt: new Date(Date.now() + 7 * 3600_000),
          staleUntil: new Date(Date.now() + 7 * 86400_000),
        },
        update: {
          payload: json(working),
          expiresAt: new Date(Date.now() + 7 * 3600_000),
          staleUntil: new Date(Date.now() + 7 * 86400_000),
        },
      });
    },
    { maxWait: 10_000, timeout: 5 * 60_000 },
  );
  Object.assign(data, working);
}

/** Publish a small set of match details without scanning or rewriting every fixture. */
export async function persistMatchDetails(
  data: Dataset,
  matchIds: Set<string>,
  profileIds: Set<string>,
) {
  assertJobActive();
  const working = structuredClone(data);
  const matches = working.matches.filter((match) => matchIds.has(match.id));
  const players = working.players.filter((player) => profileIds.has(player.id));
  await database.$transaction(
    async (tx) => {
      for (const player of players) {
        await tx.player.upsert({
          where: { id: player.id },
          create: {
            id: player.id,
            slug: player.slug,
            name: player.name,
            teamId: player.teamId,
            position: player.position,
            number: player.number,
            nationality: player.nationality,
            photo: player.photo,
            birthDate: player.birthDate ? new Date(player.birthDate) : null,
          },
          update: {
            name: player.name,
            teamId: player.teamId,
            position: player.position,
            number: player.number,
            photo: player.photo,
          },
        });
        const search = {
          id: `player:${player.id}`,
          entityType: 'player',
          entityId: player.id,
          title: player.name,
          normalized: slugify(player.name),
          href: `/joueur/${player.slug}`,
        };
        await tx.searchIndex.upsert({ where: { id: search.id }, create: search, update: search });
      }
      for (const match of matches) {
        await tx.match.update({
          where: { id: match.id },
          data: { payload: json(match), source: match.source, status: match.status },
        });
        await tx.matchEvent.deleteMany({ where: { matchId: match.id } });
        if (match.events.length)
          await tx.matchEvent.createMany({
            data: match.events.map((event, index) => ({
              id: `${match.id}-event-${index}`,
              matchId: match.id,
              teamId: event.teamId,
              minute: event.minute,
              extra: event.extra,
              type: event.type,
              payload: json(event),
            })),
          });
        await tx.matchLineup.deleteMany({ where: { matchId: match.id } });
        for (const lineup of match.lineups)
          await tx.matchLineup.create({
            data: {
              id: `${match.id}-${lineup.teamId}`,
              matchId: match.id,
              teamId: lineup.teamId,
              formation: lineup.formation,
              confirmed: lineup.confirmed,
              publishedAt: new Date(
                match.detailObservedAt?.lineups ?? match.detailsUpdatedAt ?? match.updatedAt,
              ),
              payload: json(lineup),
            },
          });
        await tx.matchPlayer.deleteMany({ where: { matchId: match.id } });
        for (const performance of match.performances ?? [])
          await tx.matchPlayer.create({
            data: {
              id: `${match.id}-${performance.playerId}`,
              matchId: match.id,
              playerId: performance.playerId,
              minutes: performance.stats.minutes,
              score: playerPerformance(performance.stats, performance.position),
              statistics: json(performance.stats),
            },
          });
      }
      working.verifiedAt = { ...working.verifiedAt, details: new Date().toISOString() };
      await fencePublication(tx);
      await tx.cacheEntry.upsert({
        where: { key: 'football:dataset' },
        create: {
          key: 'football:dataset',
          payload: json(working),
          expiresAt: new Date(Date.now() + 7 * 3600_000),
          staleUntil: new Date(Date.now() + 7 * 86400_000),
        },
        update: {
          payload: json(working),
          expiresAt: new Date(Date.now() + 7 * 3600_000),
          staleUntil: new Date(Date.now() + 7 * 86400_000),
        },
      });
    },
    { maxWait: 10_000, timeout: 5 * 60_000 },
  );
  Object.assign(data, working);
}
