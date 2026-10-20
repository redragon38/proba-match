#!/usr/bin/env bash
set -Eeuo pipefail

# Apply only the reviewed prediction fix. Preserve the VPS branch, Caddy, env
# files and unrelated changes. Abort rather than overwrite a conflicting file.
cd /opt/proba-match/app
test -s .env.vps
revision=${1:?Pass the fetched fix commit SHA}
git rev-parse --verify "${revision}^{commit}" >/dev/null
files=(
  compose.production.yml
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
  src/services/football/jobs.ts
)
patch=$(mktemp)
background_stopped=0
cleanup() {
  rm -f "$patch"
  if [[ "$background_stopped" == 1 ]]; then
    docker compose -f compose.production.yml start worker scheduler || true
  fi
}
trap cleanup EXIT

matches_revision() {
  local candidate=$1 file expected actual
  for file in "${files[@]}"; do
    if ! expected=$(git rev-parse --verify "${candidate}:${file}" 2>/dev/null); then expected=""; fi
    actual=""
    if [[ -f "$file" ]]; then actual=$(git hash-object "$file"); fi
    if [[ "$actual" != "$expected" ]]; then return 1; fi
  done
  return 0
}

if matches_revision "$revision"; then
  echo "Correctif deja applique."
else
  base=""
  for candidate in 39ad074bc07b1dd8f8159853fb1cb9e841c34999 c20da88582f8c9ff7a15a56732f1a7cb57444d16 b938676af3507b3bc72e31e5fe9c681146b2291f fc9214fde865e2ff3c5de82bf39c3956d988ac6f; do
    if matches_revision "$candidate"; then base=$candidate; break; fi
  done
  if [[ -z "$base" ]]; then
    echo "Les fichiers du VPS ne correspondent a aucune version connue. Aucun fichier modifie." >&2
    exit 1
  fi
  git diff --binary "$base" "$revision" -- "${files[@]}" > "$patch"
  test -s "$patch"
  git apply --check "$patch"
  install -d -m 0700 .local/prediction-backups
  existing=()
  for file in "${files[@]}"; do
    if [[ -f "$file" ]]; then existing+=("$file"); fi
  done
  tar -czf ".local/prediction-backups/$(date +%Y%m%d-%H%M%S).tar.gz" "${existing[@]}"
  git apply "$patch"
fi

# Free background CPU before compilation; keep the public application running.
background_stopped=1
docker compose -f compose.production.yml stop worker scheduler
docker compose -f compose.production.yml build app worker scheduler
docker compose -f compose.production.yml up -d --no-deps app worker scheduler
background_stopped=0

# Reconcile the required unique index on databases imported without all indexes.
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
  echo "Deploiement termine. Le cache des pages se renouvelle sous cinq minutes."
else
  echo "Le traitement ou sa verification a echoue. Codes du worker :" >&2
  docker compose -f compose.production.yml logs --no-log-prefix --tail 200 worker |
    grep -E '"event":"FOOTBALL_(LEASE_RENEWAL_FAILED|LEASE_OWNERSHIP_LOST|JOB_FAILED)"' || true
  exit 1
fi
