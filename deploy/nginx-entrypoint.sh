#!/bin/sh
set -e

if [ -n "$DOMAIN" ] && [ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]; then
  echo "[nginx] SSL enabled for ${DOMAIN}"
  export DOMAIN
  envsubst '${DOMAIN}' < /etc/nginx/templates/ssl.conf.template > /etc/nginx/conf.d/default.conf
else
  echo "[nginx] HTTP mode (no SSL certificate yet)"
  cp /etc/nginx/templates/init.conf /etc/nginx/conf.d/default.conf
fi

exec nginx -g 'daemon off;'
