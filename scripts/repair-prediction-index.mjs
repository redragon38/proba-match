import { PrismaClient } from '@prisma/client';
import { pathToFileURL } from 'node:url';

export async function repairPredictionIndex(db) {
  const indexes = await db.$queryRaw`
    SELECT i.indisvalid AS valid, i.indimmediate AS immediate,
      c.relname AS name
    FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
    WHERE i.indrelid = '"Prediction"'::regclass AND i.indisunique
      AND i.indpred IS NULL AND i.indexprs IS NULL AND i.indnkeyatts = 3
      AND (SELECT array_agg(a.attname::text ORDER BY a.attname)
        FROM unnest(i.indkey) WITH ORDINALITY AS k(attnum, position)
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
        WHERE k.position <= i.indnkeyatts) = ARRAY['kind','matchId','versionId']::text[]
  `;
  if (indexes.some((index) => index.valid && index.immediate))
    return { status: 'success', index: 'already-valid' };
  const [duplicates] = await db.$queryRaw`
    SELECT count(*)::int AS groups FROM (
      SELECT 1 FROM "Prediction" GROUP BY "matchId", "versionId", "kind"
      HAVING count(*) > 1
    ) duplicates
  `;
  if (duplicates.groups) throw new Error('PREDICTION_DUPLICATES_REQUIRE_REVIEW');
  // PostgreSQL performs the authoritative uniqueness check during construction.
  // CONCURRENTLY keeps normal reads/writes available; never run inside a transaction.
  // The generated identifier contains only fixed characters and decimal digits.
  const name = `Prediction_match_version_kind_repair_${Date.now()}`;
  await db.$executeRawUnsafe(
    `CREATE UNIQUE INDEX CONCURRENTLY "${name}" ON "Prediction" ("matchId", "versionId", "kind")`,
  );
  return { status: 'success', index: 'created' };
}

if (!process.argv[1] || pathToFileURL(process.argv[1]).href === import.meta.url) {
  const db = new PrismaClient({
    datasourceUrl:
      process.env.USE_AIVEN_DATABASE === 'true'
        ? process.env.AIVEN_DATABASE_URL
        : process.env.DATABASE_URL,
    log: [],
  });
  try {
    console.log(JSON.stringify(await repairPredictionIndex(db)));
  } catch (error) {
    console.log(
      JSON.stringify({
        status: 'failed',
        prismaCode: error.code ?? null,
        sqlState: error.meta?.code ?? null,
        reason:
          error.message === 'PREDICTION_DUPLICATES_REQUIRE_REVIEW'
            ? error.message
            : 'PREDICTION_INDEX_REPAIR_FAILED',
      }),
    );
    process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}
