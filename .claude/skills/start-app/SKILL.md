---
name: start-app
description: Start the Restaurant SaaS app — Docker, backend (Elysia :3010), and frontend (Next.js :3002)
triggers:
  - "รัน"
  - "start"
  - "เริ่มรัน"
  - "รัน frontend"
  - "รัน backend"
---

## Steps

1. Start Docker containers (PostgreSQL :5433, Redis :6380, MinIO :9000)
2. Push DB schema (in case of new migrations)
3. Start backend in background, log to /tmp/backend.log
4. Start frontend in background, log to /tmp/frontend.log
5. Wait and verify both are up

```bash
# 1. Docker
cd /Users/admin/Restaurant/myplatfrom
docker compose up -d

# 2. DB push
cd /Users/admin/Restaurant/myplatfrom/backend
bun run db:push

# 3. Backend
cd /Users/admin/Restaurant/myplatfrom/backend
bun run dev > /tmp/backend.log 2>&1 &
echo $! > /tmp/backend.pid

# 4. Frontend
cd /Users/admin/Restaurant/myplatfrom/frontend
bun run dev --port 3002 > /tmp/frontend.log 2>&1 &
echo $! > /tmp/frontend.pid

# 5. Verify (after ~5s)
sleep 5
curl -s http://localhost:3010/health
curl -s -o /dev/null -w "Frontend: %{http_code}" http://localhost:3002
```

**Ports:** Frontend :3002 · Backend :3010 · PostgreSQL :5433 · Redis :6380 · MinIO :9000/:9001
