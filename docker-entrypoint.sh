#!/bin/sh
set -e

echo "==> Mikopo App VPS Docker Entrypoint Starting..."

mkdir -p "${UPLOAD_DIR:-./uploads}"

if [ -n "$DATABASE_URL" ]; then
  echo "==> Running Prisma database schema synchronization (prisma db push)..."
  npx prisma db push --schema=./src/prisma/schema.prisma --skip-generate || {
    echo "==> Warning: Prisma db push failed or pending database availability. Retrying in 5s..."
    sleep 5
    npx prisma db push --schema=./src/prisma/schema.prisma --skip-generate
  }
fi

echo "==> Starting production server on port ${PORT:-3000}..."
exec node dist/server/server.js
