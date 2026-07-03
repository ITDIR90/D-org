#!/bin/sh
if [ "$#" -gt 0 ]; then
  exec "$@"
fi

set -e

echo "[backend] Database target:"
python -c "from app.core.config import get_settings; print(get_settings().DATABASE_URL.split('@')[-1])" || true

echo "[backend] Waiting for database..."
ready=0
i=1
while [ "$i" -le 45 ]; do
  if python -m app.db.wait_for_db; then
    echo "[backend] Database is ready"
    ready=1
    break
  fi
  i=$((i + 1))
  sleep 2
done
if [ "$ready" -ne 1 ]; then
  echo "[backend] ERROR: database is not reachable after 90s"
  exit 1
fi

echo "[backend] Applying migrations..."
alembic upgrade head

echo "[backend] Initializing database (if empty)..."
python -m app.db.init_db || true

echo "[backend] Starting API on :8000..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1
