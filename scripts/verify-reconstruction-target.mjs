import { PrismaClient } from '@prisma/client';

const EXPECTED_DATABASE = 'proba_match_reconstruction_test';
const EXPECTED_MODELS = [
  'ApiQuota',
  'CacheEntry',
  'Coach',
  'Competition',
  'Country',
  'DataSource',
  'EloHistory',
  'Favorite',
  'FootballIdentity',
  'Injury',
  'MappingIssue',
  'Match',
  'MatchEvent',
  'MatchLineup',
  'MatchPlayer',
  'ModelPerformance',
  'NotificationSubscription',
  'Player',
  'PlayerStatistics',
  'Prediction',
  'PredictionResult',
  'PredictionVersion',
  'ResultObservation',
  'SearchIndex',
  'Season',
  'Standing',
  'SyncLock',
  'SyncRun',
  'Team',
  'TeamStatistics',
  'Venue',
];

const action = process.argv[2];
if (!['empty', 'schema', 'counts'].includes(action)) {
  console.error('Usage: node scripts/verify-reconstruction-target.mjs empty|schema|counts');
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL_REQUIRED');

const parsed = new URL(url);
const database = parsed.pathname.slice(1);
const sslmode = parsed.searchParams.get('sslmode');
if (database !== EXPECTED_DATABASE) throw new Error('WRONG_DATABASE');
if (!parsed.hostname.endsWith('.aivencloud.com')) throw new Error('WRONG_HOST');
if (sslmode !== 'require') throw new Error('SSL_REQUIRED');

const prisma = new PrismaClient();

try {
  const tables = await prisma.$queryRaw`
    select tablename
    from pg_catalog.pg_tables
    where schemaname = 'public'
    order by tablename
  `;
  const tableNames = tables.map((row) => row.tablename);

  if (action === 'empty') {
    if (tableNames.length) throw new Error(`TARGET_NOT_EMPTY:${tableNames.join(',')}`);
    console.log(JSON.stringify({ status: 'PASS', database, publicTables: 0 }, null, 2));
    process.exit(0);
  }

  const expected = [...EXPECTED_MODELS, '_prisma_migrations'].sort();
  const missing = expected.filter((name) => !tableNames.includes(name));
  const unexpected = tableNames.filter((name) => !expected.includes(name));
  if (missing.length || unexpected.length) {
    throw new Error(
      `SCHEMA_MISMATCH:${JSON.stringify({
        missing,
        unexpected,
      })}`,
    );
  }

  if (action === 'schema') {
    console.log(JSON.stringify({ status: 'PASS', database, publicTables: tableNames }, null, 2));
    process.exit(0);
  }

  const counts = {};
  for (const table of expected) {
    const safeTable = table.replace(/"/g, '""');
    const rows = await prisma.$queryRawUnsafe(`select count(*)::text as count from "${safeTable}"`);
    counts[table] = Number(rows[0]?.count ?? 0);
  }

  console.log(JSON.stringify({ status: 'PASS', database, counts }, null, 2));
} finally {
  await prisma.$disconnect();
}
