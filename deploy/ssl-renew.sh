#!/bin/sh
set -e

cd "$(dirname "$0")/.."

docker compose -f docker-compose.prod.yml run --rm certbot renew --webroot -w /var/www/certbot
docker compose -f docker-compose.prod.yml exec -T web nginx -s reload

echo "Certificate renewed, nginx reloaded."
