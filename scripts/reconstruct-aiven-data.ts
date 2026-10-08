import { Prisma, PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
import { slugify } from '../src/lib/format';
import { createPublicOpenFootballFallback } from '../src/services/football/public-fallback';

const targetUrl = process.env.AIVEN_DATABASE_URL ?? process.env.DATABASE_URL;
const allowNonAiven = process.env.ALLOW_NON_AIVEN_RECONSTRUCTION === 'true';
const allowNonEmpty = process.env.ALLOW_NON_EMPTY_AIVEN === 'true';

if (!targetUrl) throw new Error('AIVEN_DATABASE_URL_REQUIRED');

const parsed = new URL(targetUrl);
if (!allowNonAiven && !parsed.hostname.endsWith('.aivencloud.com'))
  throw new Error('AIVEN_DATABASE_REQUIRED');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: targetUrl,
    },
  },
});

type CountRow = {
  competitions: bigint;
  seasons: bigint;
  teams: bigint;
  matches: bigint;
  players: bigint;
  predictions: bigint;
  cache_entries: bigint;
};

async function counts() {
  const rows = await prisma.$queryRaw<CountRow[]>`
    SELECT
      (SELECT count(*) FROM "Competition") AS competitions,
      (SELECT count(*) FROM "Season") AS seasons,
      (SELECT count(*) FROM "Team") AS teams,
      (SELECT count(*) FROM "Match") AS matches,
      (SELECT count(*) FROM "Player") AS players,
      (SELECT count(*) FROM "Prediction") AS predictions,
      (SELECT count(*) FROM "CacheEntry") AS cache_entries
  `;

  return Object.fromEntries(
    Object.entries(rows[0]).map(([key, value]) => [key, Number(value)]),
  ) as Record<keyof CountRow, number>;
}

function stableId(prefix: string, value: string) {
  return `${prefix}_${createHash('sha1').update(value).digest('hex').slice(0, 24)}`;
}

function countryCode(country: string) {
  return country.slice(0, 2).toUpperCase();
}

function seasonId(competitionId: string, year: number) {
  return `${competitionId}:${year}`;
}

function matchSeasonYear(kickoff: string, fallback: number) {
  const date = new Date(kickoff);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.getUTCMonth() >= 6 ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
}

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function main() {
  const before = await counts();
  if (
    !allowNonEmpty &&
    (before.competitions > 0 || before.seasons > 0 || before.teams > 0 || before.matches > 0)
  )
    throw new Error(`TARGET_NOT_EMPTY ${JSON.stringify(before)}`);

  const now = new Date();
  const dataset = await createPublicOpenFootballFallback(now);
  const warning =
    'Base reconstruite depuis OpenFootball public. Historique Neon, prédictions historiques, joueurs, compositions et statistiques avancées non recréés.';
  const countries = new Map<string, { id: string; name: string; code: string }>();

  for (const competition of dataset.competitions) {
    const code = countryCode(competition.country);
    countries.set(competition.country, {
      id: stableId('country', competition.country),
      name: competition.country,
      code,
    });
  }

  await prisma.$transaction(
    async (tx) => {
      for (const country of countries.values()) {
        await tx.country.upsert({
          where: { id: country.id },
          create: country,
          update: { name: country.name, code: country.code },
        });
      }

      for (const competition of dataset.competitions) {
        const country = countries.get(competition.country);
        if (!country) continue;
        await tx.competition.upsert({
          where: { id: competition.id },
          create: {
            id: competition.id,
            slug: competition.slug,
            name: competition.name,
            countryId: country.id,
          },
          update: {
            slug: competition.slug,
            name: competition.name,
            countryId: country.id,
          },
        });

        await tx.season.upsert({
          where: {
            competitionId_year: {
              competitionId: competition.id,
              year: competition.season,
            },
          },
          create: {
            id: seasonId(competition.id, competition.season),
            competitionId: competition.id,
            year: competition.season,
          },
          update: {},
        });
      }

      for (const team of dataset.teams) {
        const country =
          [...countries.values()].find((entry) => entry.name === team.country) ??
          [...countries.values()][0];
        if (!country) continue;
        await tx.team.upsert({
          where: { id: team.id },
          create: {
            id: team.id,
            slug: team.slug,
            name: team.name,
            countryId: country.id,
            logo: team.logo,
          },
          update: {
            slug: team.slug,
            name: team.name,
            countryId: country.id,
            logo: team.logo,
          },
        });
      }

      for (const match of dataset.matches) {
        const year = matchSeasonYear(match.kickoff, match.season ?? new Date().getUTCFullYear());
        const sid = seasonId(match.competitionId, year);
        await tx.match.upsert({
          where: { id: match.id },
          create: {
            id: match.id,
            slug: match.slug,
            seasonId: sid,
            homeId: match.homeId,
            awayId: match.awayId,
            kickoff: new Date(match.kickoff),
            status: match.status,
            homeScore: match.homeScore,
            awayScore: match.awayScore,
            source: match.source,
            payload: json(match),
          },
          update: {
            slug: match.slug,
            seasonId: sid,
            homeId: match.homeId,
            awayId: match.awayId,
            kickoff: new Date(match.kickoff),
            status: match.status,
            homeScore: match.homeScore,
            awayScore: match.awayScore,
            source: match.source,
            payload: json(match),
          },
        });
      }

      for (const [competitionId, rows] of Object.entries(dataset.standings) as Array<
        [string, Array<{ teamId: string; position: number; points: number }>]
      >) {
        const competition = dataset.competitions.find(
          (item: { id: string; season: number }) => item.id === competitionId,
        );
        if (!competition) continue;
        const sid = seasonId(competitionId, competition.season);
        for (const row of rows) {
          await tx.standing.upsert({
            where: {
              teamId_seasonId_group: {
                teamId: row.teamId,
                seasonId: sid,
                group: 'general',
              },
            },
            create: {
              id: stableId('standing', `${sid}:${row.teamId}:general`),
              teamId: row.teamId,
              seasonId: sid,
              group: 'general',
              position: row.position,
              points: row.points,
              payload: json(row),
            },
            update: {
              position: row.position,
              points: row.points,
              payload: json(row),
            },
          });
        }
      }

      for (const competition of dataset.competitions) {
        await tx.searchIndex.upsert({
          where: { id: `competition:${competition.id}` },
          create: {
            id: `competition:${competition.id}`,
            entityType: 'competition',
            entityId: competition.id,
            title: competition.name,
            normalized: slugify(competition.name),
            href: `/competition/${competition.slug}`,
          },
          update: {
            title: competition.name,
            normalized: slugify(competition.name),
            href: `/competition/${competition.slug}`,
          },
        });
      }

      for (const team of dataset.teams) {
        await tx.searchIndex.upsert({
          where: { id: `team:${team.id}` },
          create: {
            id: `team:${team.id}`,
            entityType: 'team',
            entityId: team.id,
            title: team.name,
            normalized: slugify(team.name),
            href: `/equipe/${team.slug}`,
          },
          update: {
            title: team.name,
            normalized: slugify(team.name),
            href: `/equipe/${team.slug}`,
          },
        });
      }

      await tx.cacheEntry.upsert({
        where: { key: 'football:dataset' },
        create: {
          key: 'football:dataset',
          payload: json({ ...dataset, warning, degraded: true }),
          expiresAt: new Date(now.getTime() + 6 * 60 * 60 * 1000),
          staleUntil: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        },
        update: {
          payload: json({ ...dataset, warning, degraded: true }),
          expiresAt: new Date(now.getTime() + 6 * 60 * 60 * 1000),
          staleUntil: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        },
      });
    },
    { timeout: 300000 },
  );

  const after = await counts();
  console.log(
    JSON.stringify(
      {
        status: 'success',
        target: { host: parsed.hostname, database: parsed.pathname.slice(1) },
        warning,
        before,
        after,
        dataset: {
          competitions: dataset.competitions.length,
          teams: dataset.teams.length,
          matches: dataset.matches.length,
          players: dataset.players.length,
        },
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
