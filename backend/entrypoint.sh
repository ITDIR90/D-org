#!/bin/sh
if [ "$#" -gt 0 ]; then
  exec "$@"
fi

set -e

echo "[backend] Waiting for database..."
for i in $(seq 1 30); do
  if python -m app.db.wait_for_db; then
    echo "[backend] Database is ready"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "[backend] ERROR: database is not reachable after 60s"
    exit 1
  fi
  sleep 2
done

echo "[backend] Applying migrations..."
alembic upgrade head

echo "[backend] Initializing database (if empty)..."
python -m app.db.init_db || true

echo "[backend] Starting API on :8000..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1
