#!/usr/bin/env bash
set -Eeuo pipefail

# Apply only the reviewed prediction fix. Preserve the VPS branch, Caddy, env
# files and unrelated changes. Abort rather than overwrite a conflicting file.
cd /opt/proba-match/app
test -s .env.vps
revision=${1:?Pass the fetched fix commit SHA}
git rev-parse --verify "${revision}^{commit}" >/dev/null
base=b938676af3507b3bc72e31e5fe9c681146b2291f
files=(
  .dockerignore
  ops/vps-crontab
  src/app/api/cron/predictions/route.ts
  src/features/matches/match-detail.tsx
  src/services/football/openfootball-sync.ts
  src/services/football/prediction-history.ts
  src/services/predictions.ts
  src/prediction-engine/availability.ts
  src/prediction-engine/elo.ts
  src/prediction-engine/index.ts
)
patch=$(mktemp)
trap 'rm -f "$patch"' EXIT
git diff --binary "$base" "$revision" -- "${files[@]}" > "$patch"
test -s "$patch"
if git apply --reverse --check "$patch" 2>/dev/null; then
  echo "Correctif deja applique."
else
  git apply --check "$patch"
  install -d -m 0700 .local/prediction-backups
  existing=()
  for file in "${files[@]}"; do
    if [[ -f "$file" ]]; then existing+=("$file"); fi
  done
  tar -czf ".local/prediction-backups/$(date +%Y%m%d-%H%M%S).tar.gz" "${existing[@]}"
  git apply "$patch"
fi

docker compose -f compose.production.yml build app worker scheduler
docker compose -f compose.production.yml up -d --no-deps app worker scheduler

echo "Import de l historique manquant et publication : cela peut prendre plusieurs minutes."
docker compose -f compose.production.yml exec -T worker node --input-type=module <<'NODE'
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

echo "Deploiement termine. Le cache des pages se renouvelle sous cinq minutes."
