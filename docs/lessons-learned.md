# lessons-learned.md — Project Retrospective & Reusable Patterns

> บทเรียนจาก Restaurant SaaS — ใช้เป็นแนวทางสำหรับโปรเจคถัดไป

---

## สิ่งที่ต้องทำวันแรก (Day 1 Checklist)

ก่อนเขียน feature แรก ต้อง setup สิ่งเหล่านี้ให้ครบ:

### UI Foundation
```
□ Toast system (success/error/warning/info) — wire ใน root layout
□ ConfirmModal async — แทน confirm() ทุกจุดตั้งแต่แรก
□ Providers.tsx — client wrapper สำหรับ Next.js server layout
□ Dashboard layout: h-screen overflow-hidden + main overflow-y-auto
□ LoadingScreen component
□ Form validation classes: .input-error, .field-error
```

### Convention ที่ต้อง enforce ตั้งแต่แรก
```
□ ทุก await ต้องอยู่ใน try/catch + toast.error — ไม่มีข้อยกเว้น
□ ห้ามใช้ confirm() / alert() / window.scrollTo — ถือว่า bug ทันที
□ scrollTo ต้องใช้ document.querySelector('main')?.scrollTo เสมอ
□ ห้าม base64 ใน DB — ใช้ file storage ตั้งแต่แรก
□ validation error ใน compact flex form → ใช้ input-error กรอบแดงอย่างเดียว ไม่มี field-error text (เพราะจะทำให้ layout เบี้ยว)
```

### Auth ที่ควรมีตั้งแต่แรก
```
□ POST   /auth/login
□ POST   /auth/logout
□ PATCH  /auth/change-password (ทุก role)
□ PATCH  /auth/reset-password  (super_admin only)
□ Settings page — แก้ข้อมูล profile / ร้าน
```

### File Storage
```
□ MinIO (local) หรือ S3/R2 (prod) ตั้งแต่ต้น
□ forcePathStyle: true สำหรับ MinIO
□ backend เป็น proxy upload (POST /*/image) — ไม่ให้ browser คุยกับ S3 ตรง (หลีกเลี่ยง CORS)
□ bucket policy: public-read สำหรับ assets ที่ไม่ sensitive
□ เพิ่ม MinIO ใน docker-compose + minio-init container auto-create bucket
```

---

## Patterns ที่ Validated แล้ว (นำไปใช้ได้ทันที)

### 1. Toast + ConfirmModal — Global UI State

```tsx
// components/Toast.tsx — useToast()
toast.success('บันทึกเรียบร้อย')
toast.error(err.message ?? 'เกิดข้อผิดพลาด')

// components/ConfirmModal.tsx — useConfirm()
const ok = await confirm({ title: 'ลบรายการ?', danger: true, confirmLabel: 'ลบ' })
if (!ok) return
```

Wire ใน `components/Providers.tsx` แล้วครอบใน `app/layout.tsx`:
```tsx
<body><Providers>{children}</Providers></body>
```

### 2. Event Handler Convention

```tsx
// ทุก handler ที่ call API ต้องมี pattern นี้
async function doSomething() {
  try {
    await api.patch('/endpoint', body, token)
    load(token) // หรือ update state
  } catch (e: any) {
    toast.error(e.message ?? 'เกิดข้อผิดพลาด')
  }
}
```

### 3. Dashboard Layout — Fixed Sidebar

```tsx
// layout.tsx
<div className="flex h-screen overflow-hidden">
  <Sidebar />  {/* ไม่ scroll */}
  <main className="flex-1 overflow-y-auto">
    {children}
  </main>
</div>
```

Mobile: top bar `fixed top-0` + bottom nav `fixed bottom-0` + main content `pt-14 pb-24`

### 4. requireAuth — Elysia Route Guard

```typescript
async function requireAuth(headers: any, roles: string[], set: any) {
  const auth = headers['authorization']
  if (!auth?.startsWith('Bearer ')) { set.status = 401; return null }
  try {
    const payload = await verifyJWT(auth.slice(7))
    if (!roles.includes(payload.role)) { set.status = 403; return null }
    return payload
  } catch { set.status = 401; return null }
}
```

### 5. Multi-Tenant Isolation

```typescript
// restaurantId มาจาก JWT เท่านั้น — ห้ามรับจาก body/query
const [result] = await db.select().from(table)
  .where(and(eq(table.id, params.id), eq(table.restaurant_id, payload.restaurantId!)))
```

### 6. Snapshot Pricing (สำหรับทุก e-commerce/order system)

```typescript
// order_items เก็บ snapshot ของ name + price ตอน order
// เพราะเจ้าของร้านอาจเปลี่ยนราคาเมนูทีหลัง — report ต้องถูกต้องตลอด
{
  menu_id: uuid,       // reference (nullable ถ้า menu ถูกลบ)
  menu_name: varchar,  // snapshot
  unit_price: real,    // snapshot
}
```

### 7. UUID vs Slug Routing — ป้องกัน 500

```typescript
// GET /resource/:slugOrId — ต้องเช็ค format ก่อน query UUID column
const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(param)
const condition = isUuid
  ? or(eq(table.slug, param), eq(table.id, param))
  : eq(table.slug, param)
```

### 8. SSE + Redis Pub/Sub (Realtime Push-Only)

```typescript
// backend: publish
await redis.publish(`{restaurantId}:kitchen`, JSON.stringify({ type: 'NEW_ORDER', ...data }))

// frontend: consume
useSSE('/kitchen/stream', (event) => {
  const data = JSON.parse(event.data)
  if (data.type === 'NEW_ORDER') reload()
})
```

ใช้ Redis Pub/Sub เพื่อให้ backend หลาย instance fan-out ได้ถูกต้อง

### 9. Role-Based Color System

| Role | Color | ใช้ใน badge, icon, highlight |
|---|---|---|
| super_admin | yellow/amber | |
| manager | orange (accent) | |
| employee | blue | |
| chef | teal | |
| customer | green | |

### 10. CLAUDE.md Structure

แยกไฟล์ชัดเจน:
- `CLAUDE.md` — working doc, ≤120 บรรทัด, ไม่มี changelog
- `docs/history.md` — changelog prepend newest first
- `docs/design.md` — colors, typography, components, patterns
- `docs/technical-patterns.md` — backend/frontend patterns, security

**กฎของ CLAUDE.md**: อัปเดตเฉพาะส่วนที่เปลี่ยนจริง, รอ confirm ก่อน edit ทุกครั้ง

---

## ข้อผิดพลาดที่เกิดซ้ำ (และวิธีหลีกเลี่ยง)

| ข้อผิดพลาด | เกิดจาก | วิธีหลีกเลี่ยง |
|---|---|---|
| base64 ใน DB | เริ่มง่ายก่อน แล้วค่อย migrate | ใช้ file storage ตั้งแต่วันแรก |
| `confirm()` / `alert()` | เร็วกว่าตอน dev | มี ConfirmModal พร้อมตั้งแต่แรก |
| ขาด try/catch | ลืม, หรือคิดว่าไม่น่า fail | เป็น convention บังคับ ไม่ใช่ optional |
| `window.scrollTo` | ไม่รู้ว่า layout scroll บน main | document ใน CLAUDE.md Gotchas ตั้งแต่แรก |
| design.md ผิด | เขียนก่อน implement จริง | เขียน docs ตาม code จริง ไม่ใช่ตาม plan |
| seed.ts hardcode UUID | สะดวกตอน dev | auto-detect จาก DB เสมอ |
| `GET /:slugOrId` 500 | ไม่รู้ว่า Postgres reject non-UUID string | เช็ค UUID format ก่อน query เสมอ |
| `forcePathStyle` MinIO | ไม่อยู่ใน official docs | เพิ่มใน Gotchas ทุกโปรเจค |

---

## Stack Decisions ที่ Validated

| Layer | เลือก | เหตุผล | Gotcha |
|---|---|---|---|
| Runtime | Bun | เร็วกว่า Node ~3x, native TypeScript | `--watch` อาจ race condition |
| Backend | Elysia | Type-safe, Swagger ฟรี, TypeBox validation | `t.File()` สำหรับ multipart |
| ORM | Drizzle | ไม่มี native binding issues, schema-as-code | — |
| DB | PostgreSQL | Multi-tenant ready, UUID native | UUID column ต้องรับเฉพาะ UUID format |
| Cache/RT | Redis | Pub/Sub สำหรับ SSE fan-out, session store | — |
| Storage | MinIO (dev) / S3 (prod) | S3-compatible | `forcePathStyle: true` สำหรับ MinIO |
| Frontend | Next.js 14 App Router | SSR + CSR ผสมกันได้ | Edge runtime → ใช้ `jose` ไม่ใช่ `jsonwebtoken` |
| Auth | JWT + Redis session | Stateless JWT + instant logout via Redis | Token เก็บ localStorage, session เก็บ cookie |

---

## โครงสร้างไฟล์แนะนำสำหรับโปรเจคใหม่

```
project/
├── frontend/
│   ├── app/
│   │   ├── layout.tsx              ← Providers wrap ที่นี่
│   │   ├── dashboard/[slug]/
│   │   │   └── layout.tsx          ← h-screen overflow-hidden
│   │   └── admin/                  ← super_admin UI
│   ├── components/
│   │   ├── Toast.tsx               ← useToast()
│   │   ├── ConfirmModal.tsx        ← useConfirm()
│   │   ├── Providers.tsx           ← client wrapper
│   │   └── LoadingScreen.tsx
│   └── middleware.ts               ← jose, Edge runtime
├── backend/src/
│   ├── routes/
│   │   └── auth.ts                 ← login, logout, change-password, reset-password
│   ├── lib/
│   │   ├── jwt.ts
│   │   ├── redis.ts
│   │   └── storage.ts              ← uploadFile, getPublicUrl, forcePathStyle: true
│   └── db/schema.ts                ← restaurant_id ทุก table
├── docker-compose.yml              ← postgres, redis, minio, minio-init
└── docs/
    ├── CLAUDE.md                   ← ≤120 บรรทัด
    ├── history.md                  ← changelog prepend
    ├── design.md                   ← colors, components, patterns
    └── technical-patterns.md       ← backend/frontend deep dive
```

---

## สิ่งที่ยังเหลือในทุกโปรเจค (Future Backlog Template)

สิ่งเหล่านี้มักถูกเพิ่มทีหลังเสมอ — ถ้ารู้ว่าต้องการ ให้วางแผนตั้งแต่ต้น:

- [ ] Push notifications (Web Push API)
- [ ] Export CSV / PDF
- [ ] Offline-capable PWA
- [ ] Multi-language (i18n)
- [ ] Super admin billing / plan management
- [ ] Audit log (ใครทำอะไร เมื่อไหร่)
- [ ] Rate limiting บน sensitive endpoints
- [ ] Email / SMS integration สำหรับ reset password จริง
