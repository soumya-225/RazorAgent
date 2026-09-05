#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

cleanup_ports() {
  for port in 5000 5173; do
    pids="$(lsof -ti tcp:"$port" 2>/dev/null || true)"
    if [ -n "$pids" ]; then
      echo "Stopping existing process(es) on port $port: $pids"
      for pid in $pids; do
        kill "$pid" 2>/dev/null || true
      done
      sleep 1
    fi
  done
}

cleanup_ports

echo "Starting database and API container..."
docker compose up -d --build db app --remove-orphans

for _ in $(seq 1 60); do
  if curl -fsS http://localhost:5000/api/health >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

curl -fsS http://localhost:5000/api/health >/dev/null 2>&1 || {
  echo "API did not become healthy on http://localhost:5000" >&2
  docker compose logs --tail=100 app
  exit 1
}

echo "API is healthy. Starting frontend..."
TRAP_PID=""
if [ -n "${CI:-}" ]; then
  npm run dev --prefix client -- --host 0.0.0.0
else
  npm run dev --prefix client -- --host 0.0.0.0
fi
