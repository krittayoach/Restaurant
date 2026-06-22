# history.md — Project History & Decision Log

## Changelog — v2.17 (2026-06-22)

- B: Super admin reset-password form ส่ง `phone` แต่ backend expect `email` → form ใช้งานไม่ได้มาตั้งแต่ email migration (v2.12); แก้เป็น `email` field
- U: Admin reset-password card — เพิ่ม email icon, show/hide password toggle, error message เฉพาะกรณี email ไม่พบในระบบ
- C: Super admin account ไม่มี email (สร้างก่อน v2.12) → dev setup ต้อง set `email=admin@platform.com, email_verified=true, password=bcrypt('password123')` ด้วยมือ

## Changelog — v2.16 (2026-06-22)

- F: Forgot-password flow — `POST /auth/forgot-password` (public, silent, rate limit 5/10min) ส่ง reset link ทาง email; `POST /auth/confirm-reset` (public) validate token → update password → ลบ token (single-use, TTL 1h)
- F: `/forgot-password` page — form กรอก email + success state; `/reset-password?token=` page — form ตั้งรหัสผ่านใหม่ + confirm + error state สำหรับ token หมดอายุ
- C: `tplPasswordReset` email template ใน `lib/email.ts`; Redis key `password-reset:{token}` TTL 1h ใน `lib/redis.ts`
- U: Login page — เพิ่มลิงก์ "ลืมรหัสผ่าน?" ใต้ช่อง password

## Changelog — v2.15 (2026-06-21)

- F: Dashboard i18n TH/EN toggle — `lib/i18n-dashboard.tsx` (DashboardLangProvider, useDashboardLang, DashboardLangToggle); localStorage key `dashboard-lang`, default `th`
- U: ทุก 12 dashboard pages ใช้ `useDashboardLang()` — overview, orders, kitchen, payments, menu, employees, inventory, promotions, reports, branches, tables, settings
- U: `DashboardSidebar` — nav labels, role labels, KDS link, logout confirm ผ่าน i18n; ปุ่ม toggle EN/TH ใน sidebar
- U: Overview page แยก server `page.tsx` (fetch cookies + data) + client `OverviewContent.tsx` (render + i18n)

## Changelog — v2.14 (2026-06-20)

- F: Web Push notifications — แจ้งลูกค้าเมื่ออาหารพร้อมเสิร์ฟ ทำงานแม้ปิดแท็บ/หน้าจอ (roadmap SP7)
- F: `GET /push/vapid-public-key` (public) + `POST /push/subscribe` (no-auth, qrToken เป็น secret, rate limit 20/10min ต่อ IP)
- F: `lib/push.ts` — web-push + VAPID; `sendPushToTable()` ส่งจาก Redis set พร้อม prune subscription ที่ตาย (404/410)
- F: kitchen `PATCH /kitchen/items/:id/status` → status `ready` ยิง push ไปโต๊ะลูกค้าเพิ่มจาก SSE เดิม
- F: `sw.js` เพิ่ม `push` + `notificationclick` handler; payment page มีปุ่ม "เปิดแจ้งเตือนเมื่ออาหารพร้อม" (i18n TH/EN)
- C: เพิ่ม `web-push` dependency; env `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT`; Redis key `push:subs:{rid}:{tableId}` TTL 6h + `pushRateLimit`

## Changelog — v2.13 (2026-06-11)

- B: แก้ fallback API URL `localhost:3001` → `localhost:3010` ใน customer pages (order, payment, reserve, me)
- B: phone lookup ใน order page เพิ่ม debounce 500ms — หยุดยิง API ทุก keystroke
- B: ปุ่มเพิ่มเมนูใช้ `t.addItem` ผ่าน i18n แทน hardcode ภาษาไทย
- C: rate limit public endpoints — `POST /payment/request` + `/submit` (20 req/10min), `POST /reviews` (10 req/10min) ต่อ IP; เพิ่ม Redis keys `paymentRateLimit`/`reviewRateLimit`
- C: เพิ่ม `t.Object` schema บน `promotions.ts` POST/PUT (เดิม `body as any`) และ `admin.ts` GET /stream query schema
- U: Customer pages (order, payment, reserve, me) — migrate ทั้งหมดไปใช้ design system tokens ไม่มี raw `orange-`/`gray-`/`red-` เหลือ
- U: Order page menu grid 4-col → 2-col, aspect ratio 4:3, แสดง `description` ในการ์ดเมนู
- U: Cart เปลี่ยนเป็น bottom sheet — เปิดจาก fixed bottom bar ที่แสดง item count + ยอดรวมตลอด; รวม notes + ข้อมูลลูกค้าใน sheet เดียว
- U: Reserve page pre-order menu grid 4-col → 2-col ให้สอดคล้องกับ order page
- U: เพิ่ม `aria-label` บน icon-only buttons ทุกตัวในหน้า customer
- C: `docs/roadmap.html` — เพิ่ม 4 security/quality stories เข้า SP1+SP3 (rate limit, validation, frontend security, repo cleanup); total 122→130 pts; add roadmap.html เข้า git
- B: `seed-demo.ts` — เพิ่ม `email_verified: true` เมื่อตั้ง demo emails; ก่อนหน้านี้ demo accounts login ไม่ได้บน fresh setup
- C: `docs/history.md` backlog cleanup — ลบ items ที่ implement แล้ว (reservation, loyalty, KDS, inventory, billing dashboard, offline PWA)

## Changelog — v2.12 (2026-06-11)

- F: Staff Display `/staff/[slug]/` — tablet page สำหรับ employee/manager; แสดง ready-to-serve items + payment pending; SSE realtime via `/serving/stream`; PWA install prompt
- F: Payment redesign — QR PromptPay + cash only; ลบ slip upload ออก; `POST /payment/request` (no-auth); `PAYMENT_REQUESTED` event บน SSE
- F: Review system — `reviews` table; `POST /reviews` (no-auth, orderId as secret); `GET /reviews` (manager); star rating 1-5 + comment; แสดงหลัง payment_status = paid
- F: Email login แทน phone สำหรับ staff — `users.email` + `users.email_verified`; phone ยังคงไว้สำหรับ walk-in customer loyalty
- F: Email verification flow — register ส่ง verify link ทาง Resend; login block ถ้า `email_verified = false` + resend button; `POST /auth/verify-email` + `POST /auth/resend-verification`
- F: `/verify-email` page — รับ `?token=` จาก URL, แสดง loading/success/error states
- C: Schema: `users.email` (unique), `users.email_verified` (default false), `phone` nullable, `paymentMethodEnum` เพิ่ม `promptpay`, `reviews` table ใหม่
- C: Backend env `APP_URL=http://localhost:3002` สำหรับสร้าง verify link; Redis key `email:verify:{token}` TTL 24h
- C: Demo credentials เปลี่ยนเป็น email: manager@demo.com, employee1/2@demo.com, chef1/2@demo.com (password123)

## Changelog — v2.11 (2026-06-10)

- F: Multi-branch — สร้าง/จัดการสาขาได้จาก dashboard; แต่ละสาขามี menus, tables, staff เป็นของตัวเอง
- F: `GET/POST/DELETE /restaurants/:slug/branches` — CRUD สาขา; plan-limited (free=0, basic=2, pro=∞)
- F: `POST /auth/switch-branch` + `POST /auth/switch-parent` — re-issue JWT cookie เพื่อสลับ context
- F: `GET /restaurants/:slug` คืน `parent_slug`, `parent_name`, `branches[]` เพิ่มเติม
- F: Sidebar branch switcher dropdown + "← กลับร้านหลัก" เมื่ออยู่ใน branch context
- F: หน้า `/dashboard/[slug]/branches` — จัดการสาขา, สร้าง modal, ปิดสาขา, ปุ่มเข้าสาขา
- C: `restaurants.parent_restaurant_id` — nullable self-ref FK (Drizzle schema + db:push)
- C: `PLAN_LIMITS` เพิ่ม field `branches`

## Changelog — v2.10 (2026-06-10)

- C: เพิ่ม `/update-claude` skill — list changes → confirm → อัปเดต CLAUDE.md + history.md + README.md อัตโนมัติ
- B: `stop-app` skill — แก้ port จาก 3001→3010 และ 3000→3002 ให้ตรงกับ backend/frontend จริง

## Changelog — v2.9 (2026-06-10)

- U: baseline-ui refactor ครบทุก 21 หน้า — `size-*` แทน `w-X h-X`, `cn()` แทน template string class logic, ลบ `bg-gradient-to-*` ทั้งหมด (solid token colors), `text-balance` บน h1 ทุกตัว, `aria-label` บน icon-only buttons, `z-modal`/`z-toast` แทน `z-50`, `pb-safe` บน fixed bottom bar, raw Tailwind colors → project tokens (`accent`, `rose`, `green`, `yellow`, `blue`)
- B: Dashboard overview — order count เป็น string concatenation จาก PostgreSQL (`d.count` เป็น string); แก้ด้วย `Number()` ใน reduce; เพิ่ม `toLocaleString()` และ `truncate` บน stats values
- U: Dashboard bestseller list — fixed-width columns `w-10`/`w-16` + `text-right` + `tabular-nums` ให้จำนวนและเงินเรียงตรงกันทุกแถว

## Changelog — v2.8 (2026-06-09)

- F: Rate limiting — `lib/rateLimit.ts` plugin; global 300 req/min, login 5/5 min, register 5/hr, customer-auth 30/10 min; Redis-backed + `Retry-After` header
- F: Audit log — `audit_logs` table + `lib/audit.ts` fire-and-forget; `GET /audit-logs` (super_admin: all, manager: own); 11 action types: AUTH_LOGIN, AUTH_LOGIN_FAILED, AUTH_LOGOUT, AUTH_PASSWORD_CHANGE, AUTH_PASSWORD_RESET, RESTAURANT_REGISTER, RESTAURANT_SUSPEND, RESTAURANT_UNSUSPEND, RESTAURANT_PLAN_CHANGE, PLAN_PAYMENT_APPROVE, PLAN_PAYMENT_REJECT
- F: Billing cron — `plan_expires_at` column; 30-day subscription cycle; `cron/billing.ts` รันทุก 1 ชั่วโมง downgrade expired → free + log `BILLING_DOWNGRADE`; admin UI แสดง expiry (ตัวแดงถ้า < 7 วัน)
- F: Email notifications — `lib/email.ts` Resend API wrapper; `contact_email` field ใน restaurants; ส่งเมื่อ approve/reject slip + downgrade + 7-day reminder (Redis dedup); settings page เพิ่ม field กรอก email
- B: `/start-app` skill รัน frontend ที่ port 3002 (เดิมเป็น 3000)
- C: `RESEND_API_KEY`, `PLATFORM_EMAIL_FROM` env vars; `routes/auditLogs.ts`

## Changelog — v2.7 (2026-06-09)

- U: Icon-only button tooltips ครบทุกหน้า — CSS `[data-tooltip]` pseudo-element system + ใส่ทุกปุ่ม icon-only ใน menu, employees, tables/qr, orders, payments, inventory, settings, promotions, admin
- F: Admin logout confirmation modal — กด "ออกจากระบบ" ต้องยืนยันก่อน
- F: Suspend restaurant with reason — admin กรอกเหตุผล (required) ก่อนระงับ; เหตุผลแสดงใน dashboard ของร้านที่ถูกระงับ
- F: Dashboard layout แสดงหน้า "ร้านถูกระงับ" พร้อมเหตุผลเมื่อ `is_active = false`
- F: Super admin single-session enforcement — login ใหม่ invalidate session เก่าทันที; ทุก super_admin route เช็ค Redis ผ่าน `requireSuperAdmin()`
- B: Login redirect ไป `/admin` แทน dashboard — แก้ `router.push` → `window.location.href`
- C: Schema `restaurants.suspend_reason text` + db:push
- C: Redis key `super_admin:session` + `backend/src/lib/auth.ts` (`requireSuperAdmin` helper)

## Changelog — v2.6 (2026-06-08)

- U: Menu page (dashboard) จัดกลุ่มตาม category + section headers + search bar
- U: Customer order page — ปุ่ม "เพิ่ม" สีส้ม + counter `[-][n][+]` + card border highlight เมื่อมีของในตะกร้า
- F: Shared `Spinner` component (`components/Spinner.tsx`) ใช้ `border-current` รับ color จาก parent
- F: Button-level loading states ครบทุกหน้า — dashboard (menu, employees, promotions, orders, payments, inventory, tables/qr, kitchen, reports, settings), customer (order, payment, reserve, me), auth (login, register), admin
- B: แก้ stray `}` ใน `settings/page.tsx` หลังลบ local Spinner function

## Changelog — v2.5 (2026-06-08)

- U: Settings page redesign — SectionLabel/Field components, plan card layout ใหม่ (badge + usage bars แยก), per-field show/hide password, upgrade modal slide-up บน mobile

## Changelog — v2.4 (2026-06-08)

- F: Loyalty/points system — `lib/loyalty.ts`, `routes/customers.ts`, `customers` + `point_transactions` tables; earn ฿10=1pt + จองโต๊ะ=50pt, redeem เป็นส่วนลดที่หน้า order
- F: Customer portal `/r/[slug]/me` — ค้นหาด้วยเบอร์โทร, ดูแต้ม, ประวัติจอง, ประวัติแต้ม
- F: Multi-language TH/EN — `frontend/lib/i18n.tsx` hook + `LangToggle` ทุกหน้า customer-facing
- F: Reservation pre-order — เลือกเมนูล่วงหน้าตอนจอง, บังคับอัปสลิป, banner เตือนยกเลิก 1 ชม.
- F: Reservation form validation — กรอบแดง per-field ทุก required field
- F: Unified payments page `/dashboard/[slug]/payments` — รวม order slips + pre-order slips รอยืนยัน, ปุ่ม approve/reject
- F: `GET /reservations/pending-preorders` endpoint
- C: `seed-demo.ts` — ข้อมูลจำลองครบทุกฟีเจอร์ (340 orders / 7 reservations / 6 customers / 25 menus / 15 ingredients)
- C: `README.md` สำหรับ GitHub
- C: Schema — 4 คอลัมน์ใหม่ใน `reservations` (pre_order_items, pre_order_total, pre_order_payment, pre_order_slip)

## Changelog — v2.3 (2026-06-07)

- F: Self-service plan upgrade — manager เลือก plan → ชำระด้วย PromptPay (upload slip → super admin อนุมัติ) หรือ credit card (auto-approve ทันที)
- F: `/billing` routes — `POST /upgrade`, `POST /slip`, `GET /pending-payments`, `PATCH /payments/:id/approve|reject`
- F: Admin page — section "คำขออัปเกรด" แสดง pending slips พร้อมปุ่ม approve/reject
- F: Offline PWA for KDS — Service Worker cache static shell + Next.js chunks, network-first navigation
- F: KDS offline data cache — localStorage เก็บ orders/stats, โหลดจาก cache เมื่อ offline
- F: KDS offline action queue — รับทำ/เสร็จแล้ว ขณะ offline → เก็บใน localStorage → auto-sync เมื่อ online
- F: KDS install prompt — ปุ่ม "ติดตั้งแอป" ผ่าน `beforeinstallprompt`
- C: `PLATFORM_PROMPTPAY_ID` env var ใน backend
- C: `next.config.js` — no-cache header สำหรับ `sw.js`
- C: `public/manifest.json`, `public/sw.js`, `public/icons/kds.svg`
- C: `plan_payments` table ใน schema (method, status, slip_url, reviewed_by)

## Changelog — v2.2 (2026-06-07)

- F: Export CSV / PDF บนหน้า reports — frontend-only ไม่มี library เพิ่ม
- F: Table Reservation System — `/r/[slug]/reserve` (public form + confirm page), backend `/reservations`, section ใน tables dashboard + auto-sync table status
- F: Kitchen Display System (KDS) — `/kds/[slug]` fullscreen ไม่มี sidebar, realtime SSE, protected chef+manager
- C: Git init + push ขึ้น GitHub `krittayoach/Restaurant`
- C: Project skills `/start-app` / `/stop-app`
- C: เปลี่ยน port backend 3001→3010, frontend 3000→3002 (port conflict)
- C: DB schema เพิ่ม `reservations` table + `reservation_status` enum

## Project Summary

**Restaurant SaaS** — a multi-tenant platform for Thai restaurants. Customers scan a QR code on their table, browse the menu on their phone, and place orders without any app install or account. Kitchen staff see orders in realtime. Employee staff manage the floor and payment. Managers have full control over menu, staff, promotions, and reports.

---

## Changelog — v1.9 (2026-06-03)

- G: Super Admin UI — `/admin` page: reset password + list ร้านทั้งหมด
- `GET /restaurants/all` — super_admin only (newest first)
- Middleware guard `/admin/*` + login redirect super_admin → `/admin`
- Bug: ช่องชื่อโต๊ะใน QR page เพิ่ม validation กรอบแดง (ไม่มี inline text เพื่อไม่ให้ layout เบี้ยว)

---

## Changelog — v1.8 (2026-06-03)

- D: `window.scrollTo` → `document.querySelector('main')?.scrollTo` ครบ 3 ไฟล์ (menu, promotions, employees)
- F: เพิ่ม try/catch + `toast.error()` ทุก event handler ใน 6 ไฟล์ (menu, promotions, employees, tables/qr, orders, kitchen)

---

## Changelog — v1.7 (2026-06-03)

- Settings page (`/settings`) — แก้ชื่อร้าน, PromptPay, เวลาเปิด-ปิด + เปลี่ยนรหัสผ่าน (manager)
- `PATCH /auth/change-password` — เปลี่ยนรหัสผ่านตัวเอง (ทุก role)
- `PATCH /auth/reset-password` — super_admin reset รหัสผ่าน (API only, ยังไม่มี UI)
- Manager สร้าง manager เพิ่มได้ — `POST /employees` รองรับ role `manager`
- Toast system — `components/Toast.tsx` + `useToast()` global, wire ใน root layout
- ConfirmModal — `components/ConfirmModal.tsx` + `useConfirm()` async popup
- เปลี่ยน `confirm()` native ทั้ง 6 จุด → ConfirmModal (menu, promotions, employees, QR)
- Sidebar เพิ่ม "⚙️ ตั้งค่า" (manager only)
- `docs/design.md` — แก้ color/font ที่ผิด + เพิ่ม Toast, ConfirmModal, Dashboard Layout, Image Upload, Form Validation

---

## Changelog — v1.6 (2026-06-03)

- 6.5: Menu image upload — migrate base64 → file upload จริงผ่าน MinIO (S3-compatible)
  - Backend: `POST /menus/image` multipart proxy, `storage.ts` เพิ่ม `uploadFile()` + `getPublicUrl()`
  - Frontend: spinner UI ระหว่าง upload, เก็บ public URL แทน base64
  - Docker: เพิ่ม MinIO service + minio-init auto-create bucket (public)
- UI: Dashboard sidebar fix — sidebar อยู่กับที่, เฉพาะ content เลื่อน
- UI: Logout ใช้ custom popup modal แทน native `confirm()`
- Bug: `GET /restaurants/:slug` แก้ 500 เมื่อ slug ไม่ใช่ UUID format

---

## Changelog — v1.5 (2026-05-31)

- แก้ `start.sh` ใช้ subshell `(cd ... && ...)` ให้ backend/frontend ขึ้นถูก port
- อัปเดต CLAUDE.md Dev Setup ให้แนะนำ `./start.sh` เป็น recommended command

---

## Changelog — v1.4 (2026-05-31)

- 6.1: ติดตั้ง `concurrently` — `bun run dev` ใช้ได้แล้ว
- 6.2: `seed.ts` auto-detect restaurant ID จาก DB แทน hardcode UUID
- 6.3: clear `sessionStorage.currentOrderId` เมื่อ paid (แก้ใน B1)
- 6.4: category jump bar sticky บนหน้า order ลูกค้า
- 6.6: pagination 20 รายการ/หน้า บนหน้า menu dashboard

---

## Changelog — v1.3 (2026-05-31)

- B1: clear `sessionStorage.currentOrderId` เมื่อ payment_status = paid
- B2: `start.sh` แก้ container name + รัน backend/frontend แยกแทน concurrently
- B3: `serving.ts` เพิ่ม manager role ใน serve/add-items/cancel endpoints

---

## Changelog — v1.2 (2026-05-31)

- CLAUDE.md reorganized: ลดจาก 248 → 135 บรรทัด, ลบ changelog ออกจาก CLAUDE.md
- Changelog ย้ายไป docs/history.md (format: prepend newest first)
- เพิ่ม `/update-claude Instructions` ใน CLAUDE.md กำหนด process update ใหม่

---

## v1.0 — Initial Release

### Core Features Shipped

**Multi-Tenant Foundation**
- Single PostgreSQL database, all tables scoped by `restaurant_id`
- Restaurant registration flow creates manager account + default tables + QR tokens
- `slug`-based URL routing for tenant isolation

**QR Ordering System**
- 32-byte hex `qrToken` per table, generated/reset by manager
- Customer scans → resolves table context → browses menu → places order
- No account required — customer identified by name + phone (upsert)
- httpOnly cookie stores `tableId` + `restaurantId` for session

**Realtime Kitchen & Floor**
- Redis Pub/Sub + Server-Sent Events for live order updates
- Kitchen channel: `{restaurantId}:kitchen` (NEW_ORDER, ITEM_STATUS, ORDER_ACCEPTED)
- Floor channel: `{restaurantId}:order:update` (ITEM_READY, ITEM_SERVED, ORDER_SERVED)
- 15-minute highlight on overdue kitchen orders

**Order Item State Machine**
- `pending → cooking → ready → served`
- Cancel only allowed on `pending` items
- Order-level status derived automatically from item states
- Timestamps: `startedAt`, `finishedAt`, `servedAt` per item

**Payment**
- Transfer (PromptPay slip upload) + Cash
- Employee verifies slip → table resets to available
- Refund flow available

**Staff Management**
- Roles: super_admin, manager, employee, chef
- Manager: full control (menu, staff, QR, reports, promotions, salary)
- Employee: floor + menu edit + payment confirm + check-in/out
- Chef: kitchen queue + item status + check-in/out
- Attendance tracking + salary payment log

**Menu System**
- Categories with drag-and-drop reorder
- Menu items with image, price, availability toggle
- Redis cache (5 min TTL), invalidated on any CRUD
- Snapshot of name + price stored in each order item

**Promotions**
- Percentage or fixed-amount discount
- Minimum order threshold
- Date-range validity (`starts_at` / `ends_at`)

**Reports**
- Weekly sales (7 days)
- Monthly sales
- Top 10 bestsellers by quantity + revenue

---

## Key Decisions Log

### 2025 — Initial Architecture

**Chose Elysia over Express/Hono**
Elysia provides end-to-end type safety with TypeBox schema validation and auto-generates Swagger docs. Running on Bun gives significant performance improvement over Node.js for this IO-bound workload.

**Chose Drizzle over Prisma**
Drizzle is lighter, runs natively on Bun without native bindings issues, and produces simpler SQL. Schema-as-code with full TypeScript inference. Migration workflow fits the project's pace.

**Chose SSE over WebSocket**
All realtime communication is server-to-client push only. SSE is simpler, requires no special server setup, and works reliably over HTTP/2. No need for bidirectional channels.

**Chose single-DB multi-tenant over schema-per-tenant**
Simpler ops, no dynamic schema creation, no connection pooling per tenant. All queries enforced to include `restaurant_id`. Acceptable for the projected scale (hundreds of restaurants, not thousands).

**Customer auth without registration**
Lowering friction for walk-in customers is critical. Name + phone upsert gives enough identity for order tracking without requiring an account. JWT issued per QR scan session.

**Snapshot pricing in order_items**
Menu prices can change. Storing `menu_name` and `unit_price` at order time ensures reports and receipts are always accurate, regardless of future menu edits.

---

## Changelog — v1.1 (2026-05-31)

Features & improvements shipped after v1.0:

- Redesign: warm orange/rose theme ทั้ง dashboard และหน้าลูกค้า
- Form UX: validation *, password ≥6, loading spinner ทุกหน้า
- Dashboard URL ใช้ slug แทน UUID
- Menu: grid 4 card/row + upload รูปภาพ (base64)
- Customer order flow: QR → order โดยตรง, ไม่มีแท็บสลับ, cart inline
- Reports: date range filter + ปุ่มลัด
- SSE: useSSE hook + auto-reconnect (kitchen, orders, customer payment)
- Customer payment: realtime via `{restaurantId}:table:{tableId}` channel
- Bug: kitchen actions เปิดให้ manager ด้วย

---

## Backlog / Future Considerations

- [ ] Multi-language support (EN + TH toggle) — i18n TH/EN มีแล้วในหน้า customer; dashboard ยังเป็น TH only
