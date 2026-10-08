import { db } from '@/database/client';
import { verifySecret } from '@/lib/auth';
import { syncExpandedFootball, syncExpandedPlayers } from '@/services/football/espn-sync';
import { syncOpenFootball } from '@/services/football/openfootball-sync';
import { syncSportsDbPlayers } from '@/services/football/sportsdb-sync';

export const maxDuration = 300;

type Step = 'openfootball' | 'expanded' | 'players' | 'all';

function databaseTarget() {
  const value = process.env.DATABASE_URL;
  if (!value) return { ok: false as const, error: 'DATABASE_URL_REQUIRED' };
  try {
    const url = new URL(value);
    if (!url.hostname.endsWith('.aivencloud.com'))
      return { ok: false as const, error: 'AIVEN_DATABASE_REQUIRED' };
    return { ok: true as const, host: url.hostname, database: url.pathname.slice(1) };
  } catch {
    return { ok: false as const, error: 'DATABASE_URL_INVALID' };
  }
}

function allowedEnvironment() {
  const flag = process.env.ALLOW_AIVEN_RECONSTRUCTION;
  if (flag === 'true') return true;
  if (process.env.VERCEL_ENV === 'production' && flag === 'production') return true;
  return false;
}

function bearer(request: Request) {
  return request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
}

async function counts() {
  const rows = await db.$queryRaw<
    {
      competitions: bigint;
      seasons: bigint;
      teams: bigint;
      matches: bigint;
      players: bigint;
      predictions: bigint;
      cache_entries: bigint;
    }[]
  >`
    SELECT
      (SELECT count(*) FROM "Competition") AS competitions,
      (SELECT count(*) FROM "Season") AS seasons,
      (SELECT count(*) FROM "Team") AS teams,
      (SELECT count(*) FROM "Match") AS matches,
      (SELECT count(*) FROM "Player") AS players,
      (SELECT count(*) FROM "Prediction") AS predictions,
      (SELECT count(*) FROM "CacheEntry") AS cache_entries
  `;
  const row = rows[0];
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, Number(value)]),
  ) as Record<keyof (typeof rows)[number], number>;
}

async function assertEmptyUnlessAllowed(allowNonEmpty: boolean) {
  const before = await counts();
  if (!allowNonEmpty && (before.competitions || before.teams || before.matches || before.players))
    return { ok: false as const, before };
  return { ok: true as const, before };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const queryToken = url.searchParams.get('token') ?? '';
  if (
    !verifySecret(bearer(request), process.env.MIGRATION_BOOTSTRAP_TOKEN) &&
    !verifySecret(queryToken, process.env.MIGRATION_BOOTSTRAP_TOKEN)
  )
    return Response.json({ error: 'Non autorisé' }, { status: 401 });

  if (!allowedEnvironment())
    return Response.json(
      {
        error: 'AIVEN_RECONSTRUCTION_DISABLED',
        expected:
          'Set ALLOW_AIVEN_RECONSTRUCTION=true for Preview, or production only after validation.',
      },
      { status: 403 },
    );

  const target = databaseTarget();
  if (!target.ok) return Response.json({ error: target.error }, { status: 409 });

  const step = (url.searchParams.get('step') ?? 'openfootball') as Step;
  if (!['openfootball', 'expanded', 'players', 'all'].includes(step))
    return Response.json({ error: 'INVALID_STEP' }, { status: 400 });

  const allowNonEmpty = url.searchParams.get('allow_non_empty') === 'true';
  const empty = await assertEmptyUnlessAllowed(allowNonEmpty);
  if (!empty.ok)
    return Response.json(
      {
        error: 'TARGET_DATABASE_NOT_EMPTY',
        before: empty.before,
        hint: 'Use allow_non_empty=true only for a deliberate continuation of the same reconstruction.',
      },
      { status: 409 },
    );

  const startedAt = new Date().toISOString();
  const result: Record<string, unknown> = {};
  if (step === 'openfootball' || step === 'all')
    result.openfootball = await syncOpenFootball({ history: true, force: true });
  if (step === 'expanded' || step === 'all')
    result.expanded = await syncExpandedFootball({ history: true });
  if (step === 'players' || step === 'all') {
    result.expandedPlayers = await syncExpandedPlayers();
    result.sportsDbPlayers = await syncSportsDbPlayers();
  }

  return Response.json({
    status: 'success',
    startedAt,
    finishedAt: new Date().toISOString(),
    target,
    step,
    before: empty.before,
    after: await counts(),
    result,
    warning:
      'Reconstruction from public/provider sources only. Historical Neon prediction snapshots are not recreated.',
  });
}
