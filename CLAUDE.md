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
/start-app                         # Docker + db:push + backend :3010 + frontend :3002
/stop-app                          # kill backend + frontend + docker compose down
docker compose up -d               # PostgreSQL :5433 · Redis :6380 · MinIO :9000
cd backend  && bun run dev         # Elysia :3010
cd frontend && bun run dev --port 3002
bun run db:push                    # push schema · npx tsc --noEmit (type check)
```

**Env:** `DATABASE_URL` · `REDIS_URL` · `JWT_SECRET` · `PORT=3010` · `PLATFORM_PROMPTPAY_ID`  
MinIO: `MINIO_ENDPOINT/PORT/ACCESS_KEY/SECRET_KEY/BUCKET` · Email: `RESEND_API_KEY`, `PLATFORM_EMAIL_FROM`  
Frontend: `NEXT_PUBLIC_API_URL=http://localhost:3010`

## Demo Data
- slug: `demo-restaurant` · Tables: T1–T10

| Role | เบอร์ | รหัสผ่าน |
|---|---|---|
| manager | `0812345678` | `password123` |
| employee | `0811111111` / `0822222222` | `password123` |
| chef | `0833333333` / `0844444444` | `password123` |

## New Libs / Keys
- `lib/rateLimit.ts` — `rateLimitPlugin()` Elysia plugin; Redis-backed rate limiting
- `lib/audit.ts` — `logAudit(action, opts)` fire-and-forget → `audit_logs` table
- `lib/email.ts` + `cron/billing.ts` — Resend email; billing auto-downgrade hourly
- Env: `RESEND_API_KEY`, `PLATFORM_EMAIL_FROM` · Redis: `billing:reminder:{rid}` TTL 8d

## Gotchas
- `postcss.config.js` ต้องมี — ไม่งั้น Tailwind ไม่ทำงาน
- Next.js middleware ใช้ Edge runtime → `jose` ไม่ใช้ `jsonwebtoken`
- Token เก็บใน localStorage (`getToken()`/`saveToken()`) ไม่ใช่ cookie
- Register endpoint: `POST /restaurants/register` (ไม่ใช่ `/auth/register`)
- `.next` cache เสีย → `rm -rf frontend/.next` แล้ว restart
- `bun run build` ระหว่าง dev → corrupt `.next` — ใช้ `tsc --noEmit` แทน
- `GET /restaurants/:slug` — เช็ค UUID format ก่อน query · KDS อยู่นอก dashboard layout
- `sw.js` ใน `public/` — scope `/`, `next.config.js` ตั้ง `no-cache` header
- `Spinner` ที่ `components/Spinner.tsx` — ใช้ `border-current` รับ color จาก parent
- Login ต้องใช้ `window.location.href` (ไม่ใช่ `router.push`) — ให้ browser reload เต็มรูปแบบเพื่อ cookie ใหม่ถูกส่งก่อน middleware อ่าน
- Super admin routes ทุกตัวต้องใช้ `requireSuperAdmin()` จาก `lib/auth.ts` — เช็คทั้ง JWT + Redis session
- `data-tooltip="label"` บน element ใดก็ได้ → tooltip CSS-only ผ่าน `::after` pseudo-element ใน globals.css

## UI Conventions (baseline-ui)
- `cn()` จาก `@/lib/cn` — ใช้แทน template string class logic ทุกที่
- `size-{n}` แทน `w-X h-X` สำหรับ square elements
- ห้ามใช้ `bg-gradient-to-*` — ใช้ solid token colors เท่านั้น
- `text-balance` บน heading ทุกตัว; `aria-label` บน icon-only buttons
- `z-modal` / `z-toast` แทน `z-50` / `z-[9999]`; `pb-safe` บน fixed bottom bars
- Color tokens: `accent` (orange), `rose`, `green`, `blue`, `yellow`, `muted`, `bg`/`bg2`/`bg3`, `border`

## Backlog
- [ ] multi-branch
## /update-claude Instructions
1. List changes: UI/Redesign, Features, Bug fixes, Config/Setup — รอ confirm
2. CLAUDE.md — อัปเดตเฉพาะ sections ที่เปลี่ยน ห้ามเพิ่ม changelog — ≤120 บรรทัด
3. docs/history.md — prepend `## Changelog — vX.Y (YYYY-MM-DD)` พร้อม bullet points
