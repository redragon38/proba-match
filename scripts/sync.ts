// Call the protected endpoint; keep the API key exclusively in the server environment.
const url = process.env.SYNC_URL ?? 'http://localhost:3000';
const secret = process.env.CRON_SECRET;
if (!secret || secret.length < 32)
  throw new Error('CRON_SECRET must contain at least 32 characters');
const response = await fetch(`${url}/api/cron/sync`, {
  headers: { Authorization: `Bearer ${secret}` },
  signal: AbortSignal.timeout(300_000),
});
if (!response.ok) throw new Error(`Sync failed (${response.status})`);
console.log(await response.json());
export {};
