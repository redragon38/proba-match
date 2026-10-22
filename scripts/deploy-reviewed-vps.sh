#!/usr/bin/env bash
# Reconcile only the VPS snapshot reviewed on 22 October 2026, then deploy main.
set -Eeuo pipefail
umask 077

cd /opt/proba-match/app
expected_base=46210153a407293789f0b1f43c3b8cf9f78ebb91
target=$(git rev-parse refs/remotes/origin/main)
manifest=$(mktemp /tmp/proba-match-reviewed.XXXXXX)
trap 'rm -f -- "$manifest"' EXIT
git show "$target:ops/vps-reconciliation-2026-10-22.sha256" > "$manifest"

fail() { printf '%s\n' "$*" >&2; exit 1; }
[[ $(id -u) == 0 ]] || fail 'Lancer ce script avec sudo bash.'
[[ $(git branch --show-current) == main ]] || fail 'Branche attendue : main. Aucun fichier modifié.'
[[ $(git rev-parse HEAD) == "$expected_base" ]] || fail 'Le commit du VPS a changé depuis la revue. Arrêt sans écrasement.'
git diff --cached --quiet || fail 'Index Git modifié depuis la revue. Arrêt.'
[[ -f .env.vps ]] || fail 'Configuration privée .env.vps absente.'
sha256sum --check --strict "$manifest" || fail 'Des fichiers ont changé depuis l’archive. Arrêt sans écrasement.'

declare -A allowed=()
reviewed=()
while IFS= read -r line; do
  file=${line:66}
  reviewed+=("$file")
  allowed["$file"]=1
done < "$manifest"
while IFS= read -r -d '' file; do
  [[ ${allowed[$file]:-} == 1 ]] || fail "Modification non examinée : $file. Arrêt."
done < <(git diff --name-only -z HEAD)
while IFS= read -r -d '' file; do
  case "$file" in
    Caddyfile.bak.20261020-151756|Caddyfile.bak.20261020-151822) continue ;;
  esac
  [[ ${allowed[$file]:-} == 1 ]] || fail "Nouveau fichier non examiné : $file. Arrêt."
done < <(git ls-files --others --exclude-standard -z)

stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup="/opt/proba-match/backups/reconciliation-$stamp"
mkdir -p -- "$backup"
chmod 700 "$backup"
git diff --binary HEAD > "$backup/tracked.patch"
git status --short > "$backup/status.txt"
tar -czf "$backup/reviewed-files-and-private-env.tar.gz" -- "${reviewed[@]}" .env.vps

# Preserve the exact previous code in a local branch. Never push private snapshots.
snapshot="codex/vps-preserved-$stamp"
git switch -c "$snapshot"
git add -- "${reviewed[@]}"
git -c user.name='Proba Match VPS backup' -c user.email='vps-backup@proba-match.invalid' \
  commit -m "Preserve reviewed VPS modifications before deployment $stamp"
printf '%s\n' "$snapshot" > "$backup/git-branch.txt"
git switch main
git merge --ff-only "$target"

compose=(docker compose -f compose.production.yml)
"${compose[@]}" config --quiet
# Build before replacing running containers. No down, reset, clean or volume removal.
"${compose[@]}" build
"${compose[@]}" run --rm --no-deps caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
"${compose[@]}" up -d

for service in app worker cache scheduler; do
  ready=false
  for attempt in {1..60}; do
    container=$("${compose[@]}" ps -q "$service")
    state=missing
    if [[ -n $container ]]; then
      state=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container")
    fi
    if [[ $state == healthy || $state == running ]]; then ready=true; break; fi
    if [[ $state == exited || $state == dead ]]; then break; fi
    sleep 5
  done
  "$ready" || fail "Service $service non prêt. Sauvegarde : $backup ; consulter docker compose logs."
done

# Retain static assets for existing sessions; regenerate only cached HTML pages.
"${compose[@]}" exec -T cache sh -c 'find /var/cache/nginx/pages -type f -delete'
# Bind-mounted configuration changes alone do not recreate Caddy.
"${compose[@]}" restart caddy
"${compose[@]}" ps
printf '\nVersion installée : %s\nSauvegarde privée : %s\nAncien code : branche locale %s\n' "$target" "$backup" "$snapshot"
