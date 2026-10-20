#!/usr/bin/env bash
set -Eeuo pipefail
cd /opt/proba-match/app
test -s .env.vps
revision=${1:?Pass the fetched SEO commit SHA}
git rev-parse --verify "${revision}^{commit}" >/dev/null
base=56b47e1b0d0ee3eb94fcab42d195daba0e7af0ab
files=(
  package.json
  ops/vps-crontab
  scripts/seo-monitor.mjs
  src/app/page.tsx
  src/app/matchs/page.tsx
  src/app/sitemap.ts
  src/app/api/updates/route.ts
  src/app/api/cron/seo/route.ts
  src/app/bilan-predictions/page.tsx
  src/app/admin/performance-modele/page.tsx
  'src/app/competition/[slug]/page.tsx'
  src/components/source-banner.tsx
  src/features/performance/performance.tsx
  src/features/profiles/competition-profile.tsx
  src/features/compare/comparator.tsx
  src/lib/seo.ts
  src/lib/seo-monitor.mjs
  src/lib/sitemap-lastmod.ts
  src/lib/sports-structured-data.ts
  src/services/performance-view.ts
  src/services/competition-view.ts
  src/services/football/home-predictions.ts
  src/services/football/index.ts
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
pending=()
for file in "${files[@]}"; do
  actual=""; before=""
  if [[ -f "$file" ]]; then actual=$(git hash-object "$file"); fi
  if ! before=$(git rev-parse --verify "${base}:${file}" 2>/dev/null); then before=""; fi
  after=$(git rev-parse --verify "${revision}:${file}")
  if [[ "$actual" == "$after" ]]; then continue; fi
  if [[ "$actual" != "$before" ]]; then
    echo "Conflit local : $file. Aucun fichier applique." >&2
    exit 1
  fi
  pending+=("$file")
done
if (( ${#pending[@]} )); then
  git diff --binary "$base" "$revision" -- "${pending[@]}" > "$patch"
  git apply --check "$patch"
  install -d -m 0700 .local/seo-backups
  existing=()
  for file in "${pending[@]}"; do
    if [[ -f "$file" ]]; then existing+=("$file"); fi
  done
  if (( ${#existing[@]} )); then
    tar -czf ".local/seo-backups/$(date +%Y%m%d-%H%M%S).tar.gz" "${existing[@]}"
  fi
  git apply "$patch"
fi

# The reviewed patch is now applied. Keep public traffic running during compilation.
background_stopped=1
docker compose -f compose.production.yml stop scheduler worker
docker compose -f compose.production.yml build app worker scheduler
docker compose -f compose.production.yml up -d --no-deps app worker

docker compose -f compose.production.yml exec -T worker node --input-type=module <<'NODE'
const pause = (ms) => new Promise((resolve) => setTimeout(resolve,ms));
let ready=false;
for(let attempt=0;attempt<30;attempt++){
  try { const r=await fetch('http://app:3000/healthz.txt',{signal:AbortSignal.timeout(3000)});
    if(r.ok){ready=true;break;} } catch {}
  await pause(2000);
}
if(!ready) throw new Error('APP_NOT_READY');
for(const path of ['/','/robots.txt','/sitemap.xml','/bilan-predictions']){
  const r=await fetch('http://app:3000'+path,{signal:AbortSignal.timeout(60000)});
  const html=await r.text(); const bytes=Buffer.byteLength(html);
  console.log(JSON.stringify({check:path,status:r.status,bytes}));
  if(!r.ok) throw new Error('SEO_PAGE_HTTP_FAILED');
  if(path==='/'){
    const canonical=html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/)?.[1];
    if(canonical!=='https://proba-match.com/') throw new Error('SEO_CANONICAL_FAILED');
  }
  if(path==='/robots.txt'&&!html.includes('Sitemap: https://proba-match.com/sitemap.xml'))
    throw new Error('SEO_ROBOTS_FAILED');
  if(path==='/sitemap.xml'&&!html.includes('https://proba-match.com/'))
    throw new Error('SEO_SITEMAP_FAILED');
  if(path==='/bilan-predictions'&&bytes>1000000) throw new Error('SEO_REPORT_PAYLOAD_TOO_LARGE');
}
NODE
docker compose -f compose.production.yml up -d --no-deps scheduler
background_stopped=0
echo "SEO deploye et controles internes passes. Le cache public se renouvelle sous cinq minutes."
echo "Le controle SEO quotidien est planifie ; sa premiere execution reste a observer."
