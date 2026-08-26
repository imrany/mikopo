#!/bin/sh
set -e

echo "==> [Mikopo Production] Docker Entrypoint Initializing..."

# Ensure persistent uploads directory exists with correct permissions
mkdir -p "${UPLOAD_DIR:-/app/uploads}"

# Database readiness wait and schema synchronization
if [ -n "$DATABASE_URL" ]; then
  echo "==> [Mikopo Database] Checking database availability and synchronizing schema..."
  
  MAX_TRIES=20
  COUNT=1
  SUCCESS=0

  while [ $COUNT -le $MAX_TRIES ]; do
    if npx prisma db push --schema=./src/prisma/schema.prisma --skip-generate; then
      echo "==> [Mikopo Database] Prisma schema successfully pushed to PostgreSQL!"
      SUCCESS=1
      break
    else
      echo "==> [Mikopo Database] Database not ready yet (Attempt $COUNT/$MAX_TRIES). Waiting 3s..."
      sleep 3
      COUNT=$((COUNT + 1))
    fi
  done

  if [ $SUCCESS -eq 0 ]; then
    echo "==> [Mikopo Database Warning] Could not push schema within timeout. Proceeding with server start..."
  fi
fi

# Set optimized Node runtime options for production multi-request concurrency if not already set
if [ -z "$NODE_OPTIONS" ]; then
  export NODE_OPTIONS="--max-old-space-size=2048"
fi

echo "==> [Mikopo Production] Starting production server on port ${PORT:-3000} (Node Options: $NODE_OPTIONS)..."

if [ -f "dist/server/server.js" ]; then
  exec node dist/server/server.js
elif [ -f ".output/server/index.mjs" ]; then
  exec node .output/server/index.mjs
else
  echo "==> [Mikopo Production] Searching for built server entry..."
  exec npm start
fi
