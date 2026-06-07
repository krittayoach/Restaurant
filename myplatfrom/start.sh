#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "🐳 Starting infrastructure (PostgreSQL + Redis)..."
docker compose -f "$ROOT/docker-compose.yml" up -d

echo "⏳ Waiting for PostgreSQL to be ready..."
until docker exec myplatfrom-postgres-1 pg_isready -U postgres -q 2>/dev/null; do
  sleep 1
done

echo "✅ Infrastructure ready"
echo ""
echo "🚀 Starting backend + frontend..."
echo "   Backend  → http://localhost:3001"
echo "   Frontend → http://localhost:3000"
echo "   Swagger  → http://localhost:3001/docs"
echo ""

(cd "$ROOT/backend"  && bun run dev) &
(cd "$ROOT/frontend" && bun run dev)
