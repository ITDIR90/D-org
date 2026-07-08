#!/bin/sh
set -e

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "ERROR: .env not found. Copy .env.production.example to .env first."
  exit 1
fi

# shellcheck disable=SC1091
. ./.env

if [ -z "$DOMAIN" ] || [ -z "$CERTBOT_EMAIL" ]; then
  echo "ERROR: Set DOMAIN and CERTBOT_EMAIL in .env"
  exit 1
fi

echo "Starting web container (HTTP + ACME challenge)..."
docker compose -f docker-compose.prod.yml up -d --build web

CERTBOT_ARGS="certonly --webroot -w /var/www/certbot -d $DOMAIN --email $CERTBOT_EMAIL --agree-tos --no-eff-email"
if [ "$CERTBOT_STAGING" = "true" ]; then
  echo "Using Let's Encrypt staging (test certificate)"
  CERTBOT_ARGS="$CERTBOT_ARGS --staging"
fi

echo "Requesting certificate for ${DOMAIN}..."
# shellcheck disable=SC2086
docker compose -f docker-compose.prod.yml run --rm certbot $CERTBOT_ARGS

echo "Restarting web with HTTPS..."
docker compose -f docker-compose.prod.yml up -d web

echo ""
echo "Done. Open https://${DOMAIN}"
echo "Update BACKEND_CORS_ORIGINS=https://${DOMAIN} in .env if not done yet."
echo "Add cron for renewal: 0 3 * * * $(pwd)/deploy/ssl-renew.sh"
