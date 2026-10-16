#!/usr/bin/env bash
set -Eeuo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "Lancez ce script avec sudo." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
install -d -m 0755 /opt/proba-match

apt-get update
apt-get install -y --no-install-recommends ca-certificates curl git openssl docker.io docker-compose-v2
systemctl enable --now docker

if [[ ! -d /opt/proba-match/app/.git ]]; then
  git clone --branch fix/real-player-stat-sync --single-branch \
    https://github.com/redragon38/proba-match.git /opt/proba-match/app
else
  git -C /opt/proba-match/app fetch origin fix/real-player-stat-sync
  git -C /opt/proba-match/app reset --hard origin/fix/real-player-stat-sync
fi

cd /opt/proba-match/app

if [[ ! -f .env.vps ]]; then
  read -r -s -p "Collez DATABASE_URL Aiven (la saisie reste masquee) : " database_url
  echo
  if [[ ${database_url} != postgres://* && ${database_url} != postgresql://* ]]; then
    echo "DATABASE_URL invalide." >&2
    exit 1
  fi
  cron_secret=$(openssl rand -hex 32)
  admin_secret=$(openssl rand -hex 32)
  umask 077
  cat > .env.vps <<EOF
DATABASE_URL=${database_url}
CRON_SECRET=${cron_secret}
ADMIN_SECRET=${admin_secret}
NEXT_PUBLIC_SITE_URL=https://proba-match.com
APP_ENV=production
MATCHSCORE_DEMO=false
FOOTBALL_API_PROVIDER=api-football
OPENFOOTBALL_LEAGUES=fr.1,en.1,de.1,es.1,it.1
FOOTBALL_DAILY_BUDGET=90
LEGAL_HOST_NAME=OVHcloud
LEGAL_HOST_ADDRESS=Beauharnois, Canada
EOF
  unset database_url cron_secret admin_secret
fi

chmod 600 .env.vps
docker compose -f compose.production.yml up -d --build --remove-orphans

ufw allow OpenSSH >/dev/null 2>&1 || true
ufw allow 80/tcp >/dev/null 2>&1 || true
ufw allow 443/tcp >/dev/null 2>&1 || true
ufw allow 443/udp >/dev/null 2>&1 || true

echo
echo "Installation terminee. Test local :"
curl --retry 12 --retry-delay 5 --retry-connrefused --fail --silent --show-error \
  --output /dev/null http://127.0.0.1/
echo "PROBA_MATCH_READY"
