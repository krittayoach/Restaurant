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
│   ├── r/[slug]/table/[qrToken]/   # Customer: order, payment + review
│   ├── r/[slug]/reserve/           # Customer: table reservation + pre-order
│   ├── r/[slug]/me/                # Customer: loyalty portal (แต้มสะสม)
│   ├── kds/[slug]/                 # Kitchen Display System (fullscreen)
│   ├── staff/[slug]/               # Staff Display tablet (employee+manager)
│   ├── dashboard/[slug]/           # Staff: overview, menu, orders, kitchen, tables, reservations, payments, employees, promotions, reports, branches, settings
│   ├── verify-email/               # Email verification landing page (public)
│   ├── forgot-password/            # ขอลิงก์รีเซ็ตรหัสผ่าน (public)
│   ├── reset-password/             # ตั้งรหัสผ่านใหม่ผ่าน token (public)
│   ├── admin/                      # Super admin
│   └── middleware.ts               # JWT guard + role routing (jose, Edge runtime)
├── backend/src/
│   ├── routes/   # auth, restaurants, menus, categories, tables, orders, kitchen, serving, payment, employees, reports, reservations, inventory, billing, customers, branches, reviews
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
| `{rid}:order:update` | Employee, Staff Display | ITEM_READY, ITEM_SERVED, ORDER_SERVED, PAYMENT_REQUESTED |
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
Backend: `APP_URL=http://localhost:3002` (ใช้สร้าง verify link ในอีเมล)  
Frontend: `NEXT_PUBLIC_API_URL=http://localhost:3010`

## Demo Data
- slug: `demo-restaurant` · Tables: T1–T10
- สร้างบัญชี manager ก่อนผ่าน `POST /restaurants/register` (password ตามที่ตั้งตอน register) แล้วค่อยรัน `bun run src/db/seed-demo.ts`
- `seed-demo.ts` จะตั้ง email + `email_verified: true` ให้ทุก staff อัตโนมัติ
- super_admin ไม่มี email ใน schema เดิม → `UPDATE users SET email='admin@platform.com', email_verified=true, password=<bcrypt> WHERE role='super_admin'`

| Role | Email | รหัสผ่าน |
|---|---|---|
| super_admin | `admin@platform.com` | `password123` (ต้อง set ใน DB ด้วยมือ — สร้างก่อน email migration) |
| manager | `manager@demo.com` | ตามที่ตั้งตอน register |
| employee | `employee1@demo.com` / `employee2@demo.com` | `password123` |
| chef | `chef1@demo.com` / `chef2@demo.com` | `password123` |

## New Libs / Keys
- `lib/rateLimit.ts` — `checkRateLimit(key, max, windowSecs)` + `rateLimitPlugin()`; Redis-backed; keys: `loginRateLimit`, `registerRateLimit`, `customerAuthRateLimit`, `paymentRateLimit`, `reviewRateLimit`, `pushRateLimit`
- `lib/push.ts` — Web Push (web-push + VAPID); `sendPushToTable(rid, tableId, payload)` ส่งจาก Redis set + prune subscription ที่ตาย (404/410); ยิงตอน item → `ready`
- Env: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` · Redis: `push:subs:{rid}:{tableId}` TTL 6h (set ของ subscription JSON)
- `lib/audit.ts` — `logAudit(action, opts)` fire-and-forget → `audit_logs` table
- `lib/email.ts` + `cron/billing.ts` — Resend email; billing auto-downgrade hourly
- Env: `RESEND_API_KEY`, `PLATFORM_EMAIL_FROM` · Redis: `billing:reminder:{rid}` TTL 8d
- Redis: `email:verify:{token}` TTL 24h — email verification token (UUID → userId)
- Redis: `password-reset:{token}` TTL 1h — forgot-password token (hex → userId); single-use (ลบทันทีหลัง reset)
- `users.email_verified` — false สำหรับ register ใหม่; true สำหรับ employee ที่ manager สร้าง

## Gotchas
- Staff login ใช้ `email` — phone ใช้สำหรับ walk-in customer loyalty เท่านั้น
- `email_verified` ต้องเป็น `true` ก่อน login — register ใหม่จะส่ง verify link ทาง email
- `POST /auth/forgot-password` — public, silent (ไม่บอกว่า email มีในระบบ), rate limit 5/10min ต่อ IP; token TTL 1h, single-use
- `POST /auth/confirm-reset` — public, รับ token + password ใหม่; `token_invalid` ถ้าหมดอายุหรือถูกใช้แล้ว
- `POST /payment/request`, `/payment/submit`, `POST /reviews` — no-auth public; rate limited 20/10min และ 10/10min ต่อ IP ป้องกัน spam/brute-force
- `POST /payment/request` — method: `cash` | `promptpay` เท่านั้น (slip upload ถูกลบออก)
- `GET /promotions/public/:slug` — public, คืนเฉพาะ active + ช่วงวันที่ valid; ลูกค้าส่ง `promotion_id` ใน `POST /orders`
- `POST /orders/:id/add-items` — reject 409 (`order_paid` / `order_expired`) ถ้า payment_status=paid หรือ created_at > 6h; `currentOrderId` sessionStorage เป็น `{ id, ts }` JSON TTL 4h
- `POST /reviews` — ใช้ `orderId` เป็น secret แทน auth
- `GET /push/vapid-public-key` + `POST /push/subscribe` — public; subscribe ใช้ `qrToken` เป็น secret resolve โต๊ะ, rate limit 20/10min ต่อ IP
- Web Push trigger เฉพาะ status `ready` (เพิ่มจาก SSE เดิม) · `sw.js` มี `push` + `notificationclick` handler
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

## Dashboard i18n
- `lib/i18n-dashboard.tsx` — `DashboardLangProvider` (ใน layout), `useDashboardLang()` → `{ t, lang, setLang }`, `DashboardLangToggle`
- localStorage key: `dashboard-lang` (`'th'` | `'en'`), default `th`
- Overview page เป็น server component → แยก client `components/OverviewContent.tsx` รับ data เป็น props
- `useDashboardLang()` ใช้ได้เฉพาะ client components ภายใต้ `DashboardLangProvider`

## UI Conventions (baseline-ui)
- `cn()` จาก `@/lib/cn` — ใช้แทน template string class logic ทุกที่
- `size-{n}` แทน `w-X h-X` สำหรับ square elements
- ห้ามใช้ raw Tailwind palette (`orange-X`, `gray-X`, `red-X`) — ใช้ design tokens เท่านั้น (dashboard + customer pages ใช้ tokens ครบแล้ว)
- ห้ามใช้ `bg-gradient-to-*` — ใช้ solid token colors เท่านั้น
- `text-balance` บน heading ทุกตัว; `aria-label` บน icon-only buttons ทุกตัว
- `z-modal` / `z-toast` แทน `z-50` / `z-[9999]`; `pb-safe` บน fixed bottom bars
- Color tokens: `accent` (orange), `rose`, `green`, `blue`, `yellow`, `muted`, `bg`/`bg2`/`bg3`, `border`
- Customer order page: menu grid 2-col + bottom sheet cart (เปิดจาก fixed bottom bar, รวม notes + ข้อมูลลูกค้า)

## Multi-Branch Rules
- Branch = restaurant ที่มี `parent_restaurant_id` set — มี slug, tables, menus, staff เป็นของตัวเอง
- ห้าม nested branches (branch ของ branch)
- Manager switch context ผ่าน `POST /auth/switch-branch` → JWT cookie ใหม่ → `window.location.href`
- `GET /restaurants/:slug` คืน `parent_slug`, `parent_name`, `branches[]` เสมอ
- Plan limit: free=0, basic=2, pro=∞ branches

## Backlog
## /update-claude Instructions
1. List changes: UI/Redesign, Features, Bug fixes, Config/Setup — รอ confirm
2. CLAUDE.md — อัปเดตเฉพาะ sections ที่เปลี่ยน ห้ามเพิ่ม changelog — ≤120 บรรทัด
3. docs/history.md — prepend `## Changelog — vX.Y (YYYY-MM-DD)` พร้อม bullet points
