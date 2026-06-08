# CLAUDE.md — Restaurant SaaS Platform

> Multi-tenant restaurant SaaS. ลูกค้าสั่งผ่าน QR → ครัวเห็น realtime → พนักงานจัดการ floor + ชำระเงิน

## Docs
| File | เนื้อหา |
|---|---|
| [`docs/architecture.md`](docs/architecture.md) | System diagram, ER diagram, trade-offs, sequence diagrams |
| [`docs/nfr.md`](docs/nfr.md) | Non-functional requirements: performance, security, scalability |
| [`docs/design.md`](docs/design.md) | Color system, UI patterns, rendering strategy |
| [`docs/history.md`](docs/history.md) | v1.0 features, key decisions, changelog, backlog |
| [`docs/technical-patterns.md`](docs/technical-patterns.md) | Backend/frontend patterns, Redis, SSE, security |

## Tech Stack
| Layer | Tech |
|---|---|
| Frontend | Next.js 14 App Router |
| Backend | Elysia + Bun |
| Database | PostgreSQL 16 + Drizzle ORM |
| Cache / Realtime | Redis 7 — Pub/Sub + SSE |
| Auth | JWT + Redis session (httpOnly cookie + localStorage) |

## Structure
```
myplatfrom/
├── frontend/app/
│   ├── r/[slug]/table/[qrToken]/   # Customer: order, payment
│   ├── r/[slug]/reserve/           # Customer: table reservation + pre-order
│   ├── r/[slug]/me/                # Customer: loyalty portal (แต้มสะสม)
│   ├── kds/[slug]/                 # Kitchen Display System (fullscreen)
│   ├── dashboard/[slug]/           # Staff: overview, menu, orders, kitchen, tables, payments, employees, promotions, reports, settings
│   ├── admin/                      # Super admin
│   └── middleware.ts               # JWT guard + role routing (jose, Edge runtime)
├── backend/src/
│   ├── routes/   # auth, restaurants, menus, categories, tables, orders, kitchen, serving, payment, employees, reports, reservations, inventory, billing, customers
│   ├── db/       # schema.ts, drizzle.config.ts, seed-demo.ts
│   └── lib/      # redis.ts, jwt.ts, storage.ts, loyalty.ts
└── docker-compose.yml
```

## Roles
| Role | สิทธิ์ |
|---|---|
| `manager` | full control ของร้านตัวเอง |
| `employee` | floor, serve, cancel pending, payment |
| `chef` | kitchen queue + item status |
| `customer` | walk-in via QR, ไม่มีบัญชี |

## Key Business Rules
1. ทุก query ต้องมี `restaurant_id` — multi-tenant isolation
2. `qr_token` — 32-byte hex, cross-check `slug` ป้องกัน cross-restaurant reuse
3. Item status: `pending → cooking → ready → served` — cancel ได้แค่ `pending`
4. Order status derive จาก item states อัตโนมัติ
5. Menu cache TTL 5 min — invalidate ทุกครั้งที่ CRUD menus/categories
6. Session TTL 24h — logout ลบ key ทันที
7. `restaurantId` มาจาก JWT เท่านั้น — ห้ามรับจาก body/query

## SSE Channels
| Redis Key | Consumer | Events |
|---|---|---|
| `{rid}:kitchen` | Chef, Manager | NEW_ORDER, ITEM_STATUS, ORDER_ACCEPTED |
| `{rid}:order:update` | Employee | ITEM_READY, ITEM_SERVED, ORDER_SERVED |
| `{rid}:table:{tableId}` | Customer (public) | ITEM_STATUS, ITEM_SERVED, PAYMENT_VERIFIED |

Hook: `useSSE(path, onMessage)` — auto-reconnect 3s

## Dev Setup

```bash
/start-app   # Docker + db:push + backend :3010 + frontend :3002
/stop-app    # kill processes + docker compose down

docker compose up -d               # PostgreSQL :5433 + Redis :6380
cd backend  && bun run dev         # Elysia :3010
cd frontend && bun run dev --port 3002
bun run db:push                    # push schema
```

**Ports:** Frontend 3002 · Backend 3010 · PostgreSQL 5433 · Redis 6380 · MinIO 9000/9001

**Env:**
```bash
# backend/.env
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/restaurant_saas
REDIS_URL=redis://localhost:6380
JWT_SECRET=dev-secret-change-in-production
PORT=3010
PLATFORM_PROMPTPAY_ID=0812345678
# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:3010
```

## Demo Data
- slug: `demo-restaurant` · Tables: T1–T10

| Role | เบอร์ | รหัสผ่าน |
|---|---|---|
| manager | `0812345678` | `password123` |
| employee | `0811111111` / `0822222222` | `password123` |
| chef | `0833333333` / `0844444444` | `password123` |

## Gotchas
- `postcss.config.js` ต้องมี — ไม่งั้น Tailwind ไม่ทำงาน
- `bun run --watch` อาจ race condition — kill bun แล้วเริ่มใหม่
- Next.js middleware ใช้ Edge runtime → `jose` ไม่ใช้ `jsonwebtoken`
- Token เก็บใน localStorage (`getToken()`/`saveToken()`) ไม่ใช่ cookie
- Register endpoint: `POST /restaurants/register` (ไม่ใช่ `/auth/register`)
- `.next` cache เสีย → `rm -rf frontend/.next` แล้ว restart
- MinIO `storage.ts` ต้องมี `forcePathStyle: true`
- `GET /restaurants/:slug` — เช็ค UUID format ก่อน query (Postgres error)
- Port 3000/3001 อาจชนกับ project อื่น — ใช้ 3002/3010 แทน
- KDS `/kds/[slug]` อยู่นอก dashboard layout — middleware ครอบ `/kds/:path*` แยก
- `sw.js` ต้องอยู่ใน `public/` — scope `/`, cache KDS shell + Next.js chunks
- `next.config.js` ต้องมี — ตั้ง `no-cache` header ให้ `sw.js` เพื่อรับ SW update

## Backlog — Phase 3
- [ ] Admin dashboard (MRR, จัดการร้าน, suspend, impersonate) · billing cron + email · rate limiting · audit log · multi-branch
## /update-claude Instructions
1. **List changes** แบ่งเป็น: UI/Redesign, Features, Bug fixes, Config/Setup — รอ confirm
2. **CLAUDE.md** — อัปเดตเฉพาะ sections ที่เปลี่ยน ห้ามเพิ่ม changelog — ต้องอยู่ที่ ≤120 บรรทัด
3. **docs/history.md** — prepend `## Changelog — vX.Y (YYYY-MM-DD)` พร้อม bullet points
