import { mkdir, writeFile } from 'node:fs/promises';
import { db } from '../src/database/client';
import { readLocalDataset } from '../src/services/football/local-store';
import { validateFootballData } from '../src/services/football/data-quality';
try {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_NOT_CONFIGURED');
  const data = await readLocalDataset();
  if (!data.matches.length || !data.players.length) throw new Error('VALIDATION_CORPUS_EMPTY');
  const report = validateFootballData(data);
  const [identities, stats] = await Promise.all([
    db.footballIdentity.findMany({
      select: { provider: true, kind: true, externalId: true, entityId: true },
    }),
    db.playerStatistics.findMany({ select: { playerId: true, seasonId: true } }),
  ]);
  const keys = new Set<string>();
  for (const identity of identities) {
    const key = `${identity.provider}:${identity.kind}:${identity.externalId}`;
    if (keys.has(key))
      report.issues.push({ status: 'FAIL', code: 'DUPLICATE_EXTERNAL_ID', entity: key });
    keys.add(key);
  }
  const players = new Set((await db.player.findMany({ select: { id: true } })).map((p) => p.id));
  const seasons = new Set((await db.season.findMany({ select: { id: true } })).map((s) => s.id));
  for (const stat of stats)
    if (!players.has(stat.playerId) || !seasons.has(stat.seasonId))
      report.issues.push({
        status: 'FAIL',
        code: 'PLAYER_STAT_RELATION_MISSING',
        entity: `${stat.playerId}:${stat.seasonId}`,
      });
  const photos: { player: string; status: number; image: boolean }[] = [];
  if (process.argv.includes('--photos')) {
    const allowed = new Set([
      'a.espncdn.com',
      'media.api-sports.io',
      'www.thesportsdb.com',
      'r2.thesportsdb.com',
      'upload.wikimedia.org',
      'thumb.wikimedia.org',
    ]);
    for (const p of data.players.filter((p) => p.photo).slice(0, 20)) {
      const url = new URL(p.photo!);
      if (url.protocol !== 'https:' || !allowed.has(url.hostname) || url.username || url.password)
        continue;
      try {
        const response = await fetch(url, {
          method: 'HEAD',
          redirect: 'manual',
          signal: AbortSignal.timeout(5000),
        });
        const image = response.ok && !!response.headers.get('content-type')?.startsWith('image/');
        photos.push({ player: p.id, status: response.status, image });
        if (!image)
          report.issues.push({
            status: 'WARNING',
            code: 'PHOTO_UNVERIFIED_OR_UNAVAILABLE',
            entity: p.id,
          });
      } catch {
        report.issues.push({
          status: 'WARNING',
          code: 'PHOTO_CHECK_TIMEOUT_OR_NETWORK',
          entity: p.id,
        });
      }
    }
  }
  // Read-only current club/year checks do not treat legitimate historical transfer rows as corruption.
  report.failures = report.issues.filter((i) => i.status === 'FAIL').length;
  report.warnings = report.issues.length - report.failures;
  report.status = report.failures ? 'FAIL' : report.warnings ? 'WARNING' : 'PASS';
  const directory = process.env.DATA_REPORT_DIR ?? '.local/hardening';
  await mkdir(directory, { recursive: true });
  await writeFile(
    `${directory}/data-quality.json`,
    JSON.stringify(
      { ...report, photoSample: photos, photoChecksEnabled: process.argv.includes('--photos') },
      null,
      2,
    ),
  );
  console.info(JSON.stringify({ ...report, issues: report.issues.slice(0, 20) }));
  if (report.failures) process.exitCode = 1;
} catch {
  console.info(JSON.stringify({ status: 'FAIL', code: 'DATA_VALIDATION_UNAVAILABLE' }));
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
