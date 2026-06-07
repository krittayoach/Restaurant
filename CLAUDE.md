# CLAUDE.md — Restaurant SaaS Platform

> Multi-tenant restaurant SaaS. ลูกค้าสั่งผ่าน QR → ครัวเห็น realtime → พนักงานจัดการ floor + ชำระเงิน

## Docs
| File | เนื้อหา |
|---|---|
| [`docs/design.md`](docs/design.md) | Color system, UI patterns, rendering strategy |
| [`docs/history.md`](docs/history.md) | v1.0 features, key decisions, changelog, backlog |
| [`docs/technical-patterns.md`](docs/technical-patterns.md) | Backend/frontend patterns, Redis, SSE, security |

---

## Tech Stack
| Layer | Tech |
|---|---|
| Frontend | Next.js 14 App Router |
| Backend | Elysia + Bun |
| Database | PostgreSQL 16 + Drizzle ORM |
| Cache / Realtime | Redis 7 — Pub/Sub + SSE |
| Auth | JWT + Redis session (httpOnly cookie + localStorage) |

---

## Structure
```
myplatfrom/
├── frontend/app/
│   ├── r/[slug]/table/[qrToken]/   # Customer: order, payment
│   ├── dashboard/[slug]/           # Staff: overview, menu, orders, kitchen, tables, employees, promotions, reports, settings
│   ├── admin/                      # Super admin: reset password, list restaurants
│   ├── login/ register/
│   └── middleware.ts               # JWT guard + role routing (jose, Edge runtime)
├── backend/src/
│   ├── routes/   # auth, restaurants, menus, categories, tables, orders, kitchen, serving, payment, employees, reports
│   ├── db/       # schema.ts, drizzle.config.ts
│   └── lib/      # redis.ts, jwt.ts, storage.ts
├── frontend/components/
│   ├── Toast.tsx / ConfirmModal.tsx / Providers.tsx   # Global UI: toast, confirm modal
│   ├── DashboardSidebar.tsx / LoadingScreen.tsx
└── docker-compose.yml
```

---

## Roles
| Role | สิทธิ์ |
|---|---|
| `manager` | full control ของร้านตัวเอง |
| `employee` | floor, serve, cancel pending, payment |
| `chef` | kitchen queue + item status |
| `customer` | walk-in via QR, ไม่มีบัญชี |

---

## Key Business Rules
1. ทุก query ต้องมี `restaurant_id` — multi-tenant isolation
2. `qr_token` — 32-byte hex, cross-check `slug` ป้องกัน cross-restaurant reuse
3. Item status: `pending → cooking → ready → served` — cancel ได้แค่ `pending`
4. Order status derive จาก item states อัตโนมัติ
5. Menu cache TTL 5 min — invalidate ทุกครั้งที่ CRUD menus/categories
6. Session TTL 24h — logout ลบ key ทันที
7. `restaurantId` มาจาก JWT เท่านั้น — ห้ามรับจาก body/query

---

## SSE Channels
| Redis Key | Consumer | Events |
|---|---|---|
| `{rid}:kitchen` | Chef, Manager | NEW_ORDER, ITEM_STATUS, ORDER_ACCEPTED |
| `{rid}:order:update` | Employee | ITEM_READY, ITEM_SERVED, ORDER_SERVED |
| `{rid}:table:{tableId}` | Customer (public) | ITEM_STATUS, ITEM_SERVED, PAYMENT_VERIFIED |

Hook: `useSSE(path, onMessage)` — auto-reconnect 3s, ใช้ใน kitchen/orders/customer payment

---

## Dev Setup

```bash
# Start (ต้อง kill miniproject containers ก่อนถ้า port ชน)
cd myplatfrom
./start.sh                    # Docker + backend + frontend พร้อมกัน (recommended)

# หรือรันแยก
docker compose up -d          # PostgreSQL :5433 + Redis :6380
cd backend  && bun run dev    # Elysia :3001
cd frontend && bun run dev    # Next.js :3000

# DB
bun run db:push               # push schema
bun run src/seed.ts           # seed demo data (ต้อง register ร้านก่อน)
```

**Ports:** Frontend 3000 · Backend 3001 · PostgreSQL 5433 · Redis 6380 · MinIO 9000 (API) / 9001 (Console)

**Env:**
```bash
# backend/.env
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/restaurant_saas
REDIS_URL=redis://localhost:6380
JWT_SECRET=dev-secret-change-in-production

# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

## Demo Data
- slug: `demo-restaurant` · Tables: T1–T10
- Restaurant ID: `883d99e1-d7ba-49c7-9b2a-7a9990058d49`

| Role | เบอร์ | รหัสผ่าน |
|---|---|---|
| manager | `0812345678` | `password123` |
| employee | `0811111111` / `0822222222` | `password123` |
| chef | `0833333333` / `0844444444` | `password123` |

---

## Gotchas
- `postcss.config.js` ต้องมี — ไม่งั้น Tailwind ไม่ทำงาน
- `bun run --watch` อาจ race condition — ถ้า route คืน NOT_FOUND ให้ kill bun แล้วเริ่มใหม่
- Next.js middleware ใช้ Edge runtime → `jose` ไม่ใช้ `jsonwebtoken`
- Token เก็บใน localStorage (`getToken()`/`saveToken()`) ไม่ใช่ `document.cookie`
- Register endpoint: `POST /restaurants/register` (ไม่ใช่ `/auth/register`)
- `.next` cache เสีย → `rm -rf frontend/.next` แล้ว restart
- `seed.ts` ใช้ hardcoded `RESTAURANT_ID` — ต้อง register ร้านก่อนแล้วอัปเดต UUID
- MinIO `storage.ts` ต้องมี `forcePathStyle: true` — ไม่งั้น SDK ต่อไม่ได้
- `GET /restaurants/:slug` — ต้องเช็ค UUID format ก่อน query `id` column (Postgres error ถ้าส่ง string ธรรมดา)

---

## Backlog

_(ไม่มี backlog ที่ค้างอยู่)_

---

## /update-claude Instructions

เมื่อรัน `/update-claude` ให้ทำตามขั้นตอนนี้เสมอ:

1. **List changes** จาก session นี้ แบ่งเป็น: UI/Redesign, Features, Bug fixes, Config/Setup
2. **รอ confirm** จากผู้ใช้ก่อนแก้ไฟล์ใดๆ
3. **หลัง confirm** ทำสองอย่าง:
   - **CLAUDE.md** — อัปเดตเฉพาะ sections ที่เปลี่ยนจริง (SSE Channels, Demo Data, Gotchas, Structure) ห้ามเพิ่ม changelog section เด็ดขาด — CLAUDE.md ต้องอยู่ที่ ≤120 บรรทัด
   - **docs/history.md** — prepend changelog entry ใหม่ในรูปแบบ `## Changelog — vX.Y (YYYY-MM-DD)` พร้อม bullet points กระชับ
