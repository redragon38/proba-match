#!/usr/bin/env bash
set -Eeuo pipefail
cd /opt/proba-match/app
revision=${1:?Pass the fetched fix commit SHA}
git show "${revision}:scripts/repair-prediction-index.mjs" |
  docker compose -f compose.production.yml exec -T worker node --input-type=module


echo "Import de l historique manquant et publication : cela peut prendre plusieurs minutes."
if docker compose -f compose.production.yml exec -T worker node --input-type=module <<'NODE'
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let ready = false;
for (let attempt = 0; attempt < 30; attempt++) {
  try {
    const response = await fetch('http://127.0.0.1:3000/healthz.txt', {
      signal: AbortSignal.timeout(3000),
    });
    if (response.ok) { ready = true; break; }
  } catch {}
  await pause(2000);
}
if (!ready) throw new Error('WORKER_NOT_READY');
for (let attempt = 0; attempt < 13; attempt++) {
  const response = await fetch('http://127.0.0.1:3000/api/cron/predictions', {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    signal: AbortSignal.timeout(30 * 60_000),
  });
  const result = await response.json();
  if (result.status === 'busy' && attempt < 12) {
    console.log('Une synchronisation est en cours ; nouvel essai dans 15 secondes.');
    await pause(15000);
    continue;
  }
  console.log(JSON.stringify(result, null, 2));
  if (!response.ok || result.status !== 'success' || result.history?.status === 'partial')
    process.exitCode = 1;
  break;
}
if (!process.exitCode) {
  // Verify the user's concrete example against the application, bypassing Nginx.
  const response = await fetch('http://app:3000/match/fb6b97e3-7911-8ee9-986b-8ee3b91a66f3?onglet=prediction', {
    signal: AbortSignal.timeout(60000),
  });
  const html = await response.text();
  const visible = response.ok && /class="prediction-outcome(?:\s|\")/.test(html);
  console.log(JSON.stringify({ check: 'Brest-Nice 23 octobre', httpStatus: response.status, predictionVisible: visible }));
  if (!visible) process.exitCode = 1;
}
NODE
then
  echo "Reparation terminee. Le cache des pages se renouvelle sous cinq minutes."
else
  echo "Le traitement ou sa verification a echoue. Codes du worker :" >&2
  docker compose -f compose.production.yml logs --no-log-prefix --tail 200 worker |
    grep -E '"event":"FOOTBALL_(LEASE_RENEWAL_FAILED|LEASE_OWNERSHIP_LOST|JOB_FAILED)"' || true
  exit 1
fi
