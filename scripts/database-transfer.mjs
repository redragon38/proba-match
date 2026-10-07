/** Manual native PostgreSQL migration. Never runs during build or public requests. */
import { PrismaClient } from '@prisma/client';
import { mkdir, readFile, writeFile, chmod } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';

const directory = new URL('../.database-migration/', import.meta.url);
const path = (name) => new URL(name, directory);
const quote = (value) => '"' + value.replaceAll('"', '""') + '"';
function connection(side) {
  const key = side === 'source' ? 'OLD_DATABASE_URL' : 'NEW_DATABASE_URL';
  const value = process.env[key];
  if (!value) throw new Error(`${key}_REQUIRED`);
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('INVALID_DATABASE_CONFIGURATION');
  }
  const suffix = side === 'source' ? '.neon.tech' : '.aivencloud.com';
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname.endsWith(suffix))
    throw new Error('UNEXPECTED_DATABASE_PROVIDER');
  if (
    !url.username ||
    !url.password ||
    url.pathname.length < 2 ||
    url.searchParams.get('sslmode') !== 'require'
  )
    throw new Error('DATABASE_IDENTITY_AND_SSL_REQUIRED');
  return url;
}
function nativeEnvironment(url) {
  return {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || '5432',
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    PGSSLMODE: 'require',
    PGCONNECT_TIMEOUT: '15',
    PGSERVICE: '',
    PGSERVICEFILE: '',
    PGOPTIONS: '',
  };
}
async function native(command, args, url, readonly = false) {
  const env = nativeEnvironment(url);
  if (readonly) env.PGOPTIONS = '-c default_transaction_read_only=on';
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: ['ignore', 'ignore', 'ignore'] });
    child.on('error', () => reject(new Error('POSTGRESQL_NATIVE_CLIENT_REQUIRED')));
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${command.toUpperCase()}_FAILED`)),
    );
  });
}
async function digest(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
async function save(name, value) {
  await writeFile(path(name), JSON.stringify(value, null, 2), { mode: 0o600 });
  await chmod(path(name), 0o600);
}
async function audit(side) {
  const url = connection(side);
  url.searchParams.set('connection_limit', '1');
  const db = new PrismaClient({ datasourceUrl: url.toString(), log: [] });
  try {
    return await db.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
        const [server] = await tx.$queryRawUnsafe(
          "SELECT current_setting('server_version') AS version",
        );
        const otherObjects = await tx.$queryRawUnsafe(
          "SELECT n.nspname AS schema, c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname NOT IN ('public', 'pg_catalog', 'information_schema') AND n.nspname NOT LIKE 'pg_toast%' AND n.nspname NOT LIKE 'pg_temp%' AND c.relkind IN ('r','p','v','m','S','f') ORDER BY n.nspname,c.relname",
        );
        if (otherObjects.length) throw new Error('NON_PUBLIC_SCHEMA_REVIEW_REQUIRED');
        const unsupported = await tx.$queryRawUnsafe(
          "SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('m','f')",
        );
        if (unsupported.length) throw new Error('SPECIAL_PUBLIC_OBJECT_REVIEW_REQUIRED');
        const enumTypes = await tx.$queryRawUnsafe(
          "SELECT t.typname AS name, e.enumsortorder::text AS position, e.enumlabel AS label FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' ORDER BY t.typname,e.enumsortorder",
        );
        const sequenceDefinitions = await tx.$queryRawUnsafe(
          "SELECT sequencename AS name, data_type, start_value::text, min_value::text, max_value::text, increment_by::text, cycle, cache_size::text FROM pg_sequences WHERE schemaname='public' ORDER BY sequencename",
        );
        const tables = await tx.$queryRawUnsafe(
          "SELECT tablename AS name FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
        );
        const rows = [];
        for (const { name } of tables) {
          const [row] = await tx.$queryRawUnsafe(
            `SELECT count(*)::text AS rows, md5(COALESCE(string_agg(h, '' ORDER BY h), '')) AS checksum FROM (SELECT md5(to_jsonb(t)::text) AS h FROM public.${quote(name)} t) hashes`,
          );
          rows.push({ name, ...row });
        }
        const indexes = await tx.$queryRawUnsafe(
          "SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename, indexname",
        );
        const constraints = await tx.$queryRawUnsafe(
          "SELECT r.relname AS table_name, c.conname AS name, c.contype AS type, pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid JOIN pg_namespace n ON n.oid = r.relnamespace WHERE n.nspname = 'public' ORDER BY r.relname, c.conname",
        );
        const triggers = await tx.$queryRawUnsafe(
          "SELECT r.relname AS table_name, t.tgname AS name, pg_get_triggerdef(t.oid) AS definition FROM pg_trigger t JOIN pg_class r ON r.oid = t.tgrelid JOIN pg_namespace n ON n.oid = r.relnamespace WHERE n.nspname = 'public' AND NOT t.tgisinternal ORDER BY r.relname, t.tgname",
        );
        const functions = await tx.$queryRawUnsafe(
          "SELECT p.proname AS name, pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.prokind = 'f' ORDER BY p.proname, pg_get_function_identity_arguments(p.oid)",
        );
        const views = await tx.$queryRawUnsafe(
          "SELECT viewname AS name, definition FROM pg_views WHERE schemaname = 'public' ORDER BY viewname",
        );
        const sequenceNames = await tx.$queryRawUnsafe(
          "SELECT sequencename AS name FROM pg_sequences WHERE schemaname = 'public' ORDER BY sequencename",
        );
        const sequences = [];
        for (const { name } of sequenceNames) {
          const [state] = await tx.$queryRawUnsafe(
            `SELECT last_value::text AS last_value, is_called FROM public.${quote(name)}`,
          );
          sequences.push({ name, ...state });
        }
        const columns = await tx.$queryRawUnsafe(
          "SELECT table_name, column_name, ordinal_position, data_type, udt_name, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position",
        );
        const extensions = await tx.$queryRawUnsafe(
          'SELECT extname AS name FROM pg_extension ORDER BY extname',
        );
        return {
          version: server.version,
          tables: rows,
          columns,
          indexes,
          constraints,
          triggers,
          functions,
          views,
          sequences,
          sequenceDefinitions,
          enumTypes,
          extensions,
        };
      },
      { isolationLevel: 'RepeatableRead', maxWait: 15000, timeout: 1800000 },
    );
  } finally {
    await db.$disconnect();
  }
}
function compare(source, target) {
  const differences = [];
  for (const key of [
    'tables',
    'columns',
    'indexes',
    'constraints',
    'triggers',
    'functions',
    'views',
    'sequences',
    'sequenceDefinitions',
    'enumTypes',
    'extensions',
  ]) {
    if (JSON.stringify(source[key]) !== JSON.stringify(target[key])) differences.push(key);
  }
  return {
    status: differences.length ? 'FAIL' : 'PASS',
    differences,
    tables: source.tables.map((table) => ({
      name: table.name,
      sourceRows: table.rows,
      targetRows: target.tables.find((t) => t.name === table.name)?.rows ?? 'TABLE_ABSENT',
    })),
  };
}
async function main() {
  const action = process.argv[2];
  if (!['audit-source', 'audit-target', 'export', 'restore', 'compare'].includes(action))
    throw new Error('ACTION_REQUIRED');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
  if (action.startsWith('audit-')) {
    const side = action.slice(6);
    const result = await audit(side);
    await save(`${side}.json`, result);
    console.info(JSON.stringify({ status: 'PASS', action, tables: result.tables.length }));
    return;
  }
  if (action === 'export') {
    if (process.env.MIGRATION_WRITES_PAUSED !== 'true')
      throw new Error('PAUSE_ALL_WRITERS_BEFORE_EXPORT');
    const before = await audit('source');
    await native(
      'pg_dump',
      ['--format=custom', '--no-owner', '--no-acl', '--file', path('source.dump').pathname],
      connection('source'),
      true,
    );
    await chmod(path('source.dump'), 0o600);
    const after = await audit('source');
    if (compare(before, after).status !== 'PASS') throw new Error('SOURCE_CHANGED_DURING_EXPORT');
    await save('source.json', before);
    await save('export.json', { sha256: await digest(path('source.dump')), verified: true });
  } else if (action === 'restore') {
    if (process.env.MIGRATION_WRITES_PAUSED !== 'true')
      throw new Error('PAUSE_ALL_WRITERS_BEFORE_RESTORE');
    const certificate = JSON.parse(await readFile(path('export.json'), 'utf8'));
    if (!certificate.verified || certificate.sha256 !== (await digest(path('source.dump'))))
      throw new Error('UNVERIFIED_DUMP');
    const source = JSON.parse(await readFile(path('source.json'), 'utf8'));
    const target = await audit('target');
    if (
      target.tables.length ||
      target.views.length ||
      target.functions.length ||
      target.sequences.length ||
      target.enumTypes.length
    )
      throw new Error('TARGET_MUST_BE_EMPTY');
    if (Number.parseInt(target.version) < Number.parseInt(source.version))
      throw new Error('TARGET_POSTGRES_VERSION_TOO_OLD');
    await native(
      'pg_restore',
      [
        '--no-owner',
        '--no-acl',
        '--no-tablespaces',
        '--single-transaction',
        '--exit-on-error',
        '--dbname',
        decodeURIComponent(connection('target').pathname.slice(1)),
        path('source.dump').pathname,
      ],
      connection('target'),
    );
    await save('target.json', await audit('target'));
    const result = compare(source, JSON.parse(await readFile(path('target.json'), 'utf8')));
    await save('comparison.json', result);
    if (result.status !== 'PASS') throw new Error('RESTORED_DATABASE_DIFFERS');
  } else {
    const result = compare(
      JSON.parse(await readFile(path('source.json'), 'utf8')),
      JSON.parse(await readFile(path('target.json'), 'utf8')),
    );
    await save('comparison.json', result);
    if (result.status !== 'PASS') throw new Error('DATABASES_DIFFER');
  }
  console.info(JSON.stringify({ status: 'PASS', action }));
}
try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : '';
  console.error(
    JSON.stringify({
      status: 'FAIL',
      code: /^[A-Z_]+$/.test(message) ? message : 'MIGRATION_OPERATION_FAILED',
    }),
  );
  process.exitCode = 1;
}
