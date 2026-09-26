const [from, to] = process.argv.slice(2);
if (
  !from ||
  !to ||
  ![from, to].every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(new Date(d).getTime()))
)
  throw new Error('Usage: npm run backfill -- YYYY-MM-DD YYYY-MM-DD');
const secret = process.env.CRON_SECRET;
if (!secret || secret.length < 32) throw new Error('CRON_SECRET must be configured');
const start = new Date(`${from}T12:00:00Z`),
  end = new Date(`${to}T12:00:00Z`);
if (end < start || (end.getTime() - start.getTime()) / 86400_000 > 365)
  throw new Error('Choose an ordered range of at most 366 days');
for (const date = new Date(start); date <= end; date.setUTCDate(date.getUTCDate() + 1)) {
  const key = date.toISOString().slice(0, 10);
  const response = await fetch(
    `${process.env.SYNC_URL ?? 'http://localhost:3000'}/api/cron/sync?date=${key}`,
    { headers: { Authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(300_000) },
  );
  if (!response.ok)
    throw new Error(
      `Import stopped on ${key} (${response.status}). Previous dates are saved; inspect the admin log and resume from this date.`,
    );
  console.log(key, await response.json());
}
export {};
