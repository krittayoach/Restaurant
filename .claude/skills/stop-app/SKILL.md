---
name: stop-app
description: Stop the Restaurant SaaS app — kill backend, frontend, and Docker containers
triggers:
  - "หยุดรัน"
  - "stop"
  - "ปิด"
  - "หยุด frontend"
  - "หยุด backend"
  - "kill"
---

## Steps

1. Kill backend process (port 3010)
2. Kill frontend process (port 3002)
3. Stop Docker containers

```bash
# Kill by saved PID files (if exist)
[ -f /tmp/backend.pid ] && kill $(cat /tmp/backend.pid) 2>/dev/null; rm -f /tmp/backend.pid
[ -f /tmp/frontend.pid ] && kill $(cat /tmp/frontend.pid) 2>/dev/null; rm -f /tmp/frontend.pid

# Fallback: kill by port
lsof -ti:3010 | xargs kill -9 2>/dev/null || true
lsof -ti:3002 | xargs kill -9 2>/dev/null || true

# Stop Docker
cd /Users/admin/Restaurant/myplatfrom
docker compose down
```

Confirm with: `lsof -i:3010 -i:3002` (should return empty)
