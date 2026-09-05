#!/usr/bin/env bash
set -eo pipefail

# Wait for DATABASE_URL to be reachable
: "${DATABASE_URL:?DATABASE_URL must be set in env}"

# Extract host and port from DATABASE_URL for a basic TCP wait (fallback if psql not available)
host_port="$(echo "$DATABASE_URL" | sed -n 's#.*@\([^:/]*\):\([0-9]*\)/.*#\1:\2#p')"
if [ -n "$host_port" ]; then
  host=$(echo "$host_port" | cut -d: -f1)
  port=$(echo "$host_port" | cut -d: -f2)
else
  host="localhost"
  port=5432
fi

# wait-for-it style loop
echo "Waiting for database $host:$port to be ready..."
max_wait=60
count=0
while ! (</dev/tcp/$host/$port) 2>/dev/null; do
  count=$((count+1))
  if [ $count -gt $max_wait ]; then
    echo "Timed out waiting for database at $host:$port"
    exit 1
  fi
  sleep 1
done

echo "Database reachable — pushing Prisma schema and generating client"
# Use local prisma binary
if [ -f ./node_modules/.bin/prisma ]; then
  export DATABASE_URL
  node ./node_modules/prisma/build/index.js db push --schema prisma/schema.prisma --accept-data-loss || true
  npm run db:seed --prefix . || true
else
  echo "Prisma binary not found — skipping db push. Ensure you ran npm install."
fi

# Start server
echo "Starting server"
node src/server.js
