import { db } from '@/database/client';
import type { Dataset } from '@/types/football';
import { slugify } from '@/lib/format';
import { playerPerformance } from '@/prediction-engine/player';
const json = (value: unknown) => JSON.parse(JSON.stringify(value));
async function inBatches<T>(rows: T[], write: (row: T) => Promise<unknown>) {
  // Bound concurrent writes so remote PostgreSQL latency does not turn an import
  // into hours of serial round trips or exhaust the connection pool.
  for (let offset = 0; offset < rows.length; offset += 12)
    await Promise.all(rows.slice(offset, offset + 12).map(write));
}
export async function persistDataset(
  data: Dataset,
  changedIds: Set<string>,
  options: { profiles?: boolean; injuryTeamIds?: string[] } = {},
) {
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
  await inBatches(data.teams, async (t) => {
    const countryId = slugify(t.country) || 'international';
    await db.country.upsert({
      where: { id: countryId },
      create: { id: countryId, name: t.country },
      update: {},
    });
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
      update: { name: t.name, logo: t.logo },
    });
  });
  for (const p of options.profiles === false ? [] : data.players) {
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
    if (c && Object.values(p.stats).some((value) => value != null))
      await db.playerStatistics.upsert({
        where: { id: `${p.id}-${c.id}-${c.season}-${observedAt}` },
        create: {
          id: `${p.id}-${c.id}-${c.season}-${observedAt}`,
          playerId: p.id,
          seasonId: `${c.id}-${c.season}`,
          asOf: new Date(observedAt),
          payload: json(p.stats),
        },
        update: { payload: json(p.stats) },
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
      await db.$transaction(async (tx) => {
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
        for (const l of m.lineups)
          await tx.matchLineup.upsert({
            where: { matchId_teamId: { matchId: m.id, teamId: l.teamId } },
            create: {
              id: `${m.id}-${l.teamId}`,
              matchId: m.id,
              teamId: l.teamId,
              formation: l.formation,
              confirmed: l.confirmed,
              publishedAt: new Date(m.updatedAt),
              payload: json(l),
            },
            update: { formation: l.formation, confirmed: l.confirmed, payload: json(l) },
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
      });
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
  await db.cacheEntry.upsert({
    where: { key: 'football:dataset' },
    create: {
      key: 'football:dataset',
      payload: json(data),
      expiresAt: new Date(Date.now() + (data.source === 'openfootball' ? 7 * 3600_000 : 120_000)),
      staleUntil: new Date(Date.now() + 7 * 86400_000),
    },
    update: {
      payload: json(data),
      expiresAt: new Date(Date.now() + (data.source === 'openfootball' ? 7 * 3600_000 : 120_000)),
      staleUntil: new Date(Date.now() + 7 * 86400_000),
    },
  });
}
