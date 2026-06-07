# design.md — Design Decisions & UI Patterns

## Visual Design System

### Color Palette (Light Warm Theme)
| Token | Hex | Usage |
|---|---|---|
| `--bg` | `#fff8f0` | Page background (cream) |
| `--bg2` | `#ffffff` | Card surface |
| `--bg3` | `#fff2e3` | Inputs, chips, nested bg (warm peach) |
| `--border` | `#f3e6d4` | Default borders |
| `--border2` | `#ecd9bf` | Hover/focus borders |
| `--text` | `#2b1c10` | Primary text (warm dark brown) |
| `--muted` | `#a3917b` | Secondary/helper text (warm taupe) |
| `--accent` | `#f97316` | Primary action color (orange) |
| `--accent2` | `#fb923c` | Hover state of accent |
| `--teal` | `#0d9488` | Chef / kitchen elements |
| `--blue` | `#2563eb` | Employee / floor elements |
| `--violet` | `#7c3aed` | System / middleware |
| `--rose` | `#e11d48` | Cancel / danger |
| `--green` | `#16a34a` | Success / customer |
| `--yellow` | `#d97706` | Warning / super admin (amber) |

Body uses a warm radial-gradient overlay on `--bg` for depth (fixed attachment).

### Typography
- **Mitr** — `font-display` — headings, labels, card titles (weight 400–700)
- **DM Mono** — `font-mono` — codes, badges, phone numbers, technical labels
- **Noto Sans Thai** — `font-sans` — body text (Thai language support)

### Role Color Coding
Consistent throughout UI — badge background, icon, text all follow this:
| Role | Color | Token |
|---|---|---|
| super_admin | amber | `yellow` `#d97706` |
| manager | orange | `accent` `#f97316` |
| employee | blue | `blue` `#2563eb` |
| chef | teal | `teal` `#0d9488` |
| customer | green | `green` `#16a34a` |

---

## Architecture Decisions

### Why Multi-Tenant Single Database?
Every table has `restaurant_id`. Simple to query, easy to maintain, scales to hundreds of restaurants without managing separate schemas. Trade-off: queries MUST always include `restaurant_id` filter — enforced at the service layer.

### Why SSE Instead of WebSocket?
SSE is unidirectional (server → client), simpler to implement, works over standard HTTP/2, and fits the use cases:
- Kitchen: receives new orders (push only)
- Employee floor view: receives ready/served events (push only)

No bidirectional needs exist; WebSocket would be over-engineering.

### Why Redis Pub/Sub for SSE?
Multiple backend instances can run behind a load balancer. Redis Pub/Sub ensures all instances can fan out events to their connected SSE clients. Each restaurant has its own channel key (`{restaurantId}:kitchen`).

### Why Snapshot Columns in order_items?
`menu_name` and `unit_price` are copied at order time. This preserves the historical record — if the manager changes a menu's price or name later, past orders remain accurate.

### Why QR Token Cross-Checks Slug?
A 32-byte hex token is per-table, not per-restaurant. Without the slug check, a token from Restaurant A could theoretically be used on Restaurant B's domain. The check `token.restaurantSlug === slug` prevents this.

### Why MinIO for Menu Images?
Menu images are uploaded via backend proxy (`POST /menus/image`) to MinIO (S3-compatible). Browser never talks to MinIO directly — avoids CORS setup. Bucket is public-read; images served as plain HTTP URLs stored in `menus.image` column. `forcePathStyle: true` required for MinIO compatibility.

---

## UI Component Patterns

### Cards
Warm white surface (`--bg2`), 1px warm border, `rounded-3xl`. Hover lifts with `translateY(-3px)` + stronger shadow. Classes: `.card`, `.card-hover`.

### Status Badges
Color-coded pills matching order item states. Class: `.badge`
- `pending` → yellow
- `cooking` → orange (accent)
- `ready` → blue
- `served` → green
- `cancelled` → rose

### Toast Notifications
Global popup — `components/Toast.tsx`, hook: `useToast()`

```tsx
const toast = useToast()
toast.success('บันทึกเรียบร้อย')
toast.error('เกิดข้อผิดพลาด')
toast.warning('กรุณาตรวจสอบข้อมูล')
toast.info('กำลังโหลด...')
```

| Type | Color | Icon | ใช้เมื่อ |
|---|---|---|---|
| `success` | green | CheckCircle2 | บันทึก/ทำสำเร็จ |
| `error` | rose | AlertCircle | API error / validation fail |
| `warning` | yellow | AlertTriangle | คำเตือน |
| `info` | accent | Info | ข้อมูลทั่วไป |

- Position: top-right, stacked max 4
- Auto-dismiss 4 วิ + progress bar
- Animation: `slideInRight` / `slideOutRight`

### Confirm Modal
Async confirmation popup — `components/ConfirmModal.tsx`, hook: `useConfirm()`

```tsx
const { confirm } = useConfirm()
const ok = await confirm({ title: 'ลบรายการนี้?', message: 'ไม่สามารถเรียกคืนได้', danger: true, confirmLabel: 'ลบ' })
if (!ok) return
```

- `danger: true` → สีแดง + icon ถังขยะ
- `danger: false` (default) → สีเหลือง + icon warning
- กดนอก modal = ยกเลิก
- ใช้แทน native `confirm()` ทุกจุด

### Loading Screen
Full-page spinner — `components/LoadingScreen.tsx`. ใช้ใน `if (pageLoading) return <LoadingScreen />` ทุกหน้า CSR

### Form Validation
CSS classes สำหรับ inline validation:
- `.input-error` — border rose + bg rose/5 (ใส่บน `<input>`)
- `.field-error` — ข้อความ error สีแดง ขนาด xs (ใส่ใต้ input)

Pattern: `formSubmitted` flag + conditional class + error message

```tsx
<input className={`input ${formSubmitted && !form.name ? 'input-error' : ''}`} />
{formSubmitted && !form.name && <p className="field-error">กรุณากรอกชื่อ</p>}
```

### Dashboard Layout
Fixed sidebar + scrollable content — `app/dashboard/[slug]/layout.tsx`

```
<div class="flex h-screen overflow-hidden">
  <aside class="h-full w-64">  ← fixed, never scrolls
  <main class="flex-1 overflow-y-auto">  ← only this scrolls
```

Mobile: top bar (fixed) + bottom nav (fixed), content has `pt-14 pb-24`

### Image Upload (Menu)
Flow: user picks file → `POST /menus/image` (multipart) → backend uploads to MinIO → returns `{ url }` → stored in `menus.image`

Frontend shows spinner during upload (`uploading` state). On error shows `toast.error`. Never stores base64.

### Kitchen Board (Chef View)
- Card per order, sorted by time
- Rose highlight if order is older than 15 minutes
- Shows customer notes prominently
- Actions: "รับทำ" (accept item), "รับทั้งออเดอร์" (accept all), "เสร็จแล้ว" (done)
- Stats bar: pending / cooking / ready counts + average time today

### Floor View (Employee View)
- Table grid showing status color
- Pending/ready item count badges on each table
- "Ready" panel lists items waiting to be served across all tables
- SSE drives live updates without polling

### Customer Menu Page (QR Scan)
- SSR for fast first load (menu from Redis cache)
- Mobile-first layout
- No login required — just name + phone number
- Cart persists in component state until submitted

---

## Page Rendering Strategy

| Page | Strategy | Reason |
|---|---|---|
| Customer menu | SSR | Fast initial load, cache-friendly |
| Kitchen board | SSE + CSR | Live updates required |
| Employee floor | SSE + CSR | Live updates required |
| Manager overview | SSR | Fresh data on load |
| Manager reports | SSR | Aggregated data, no realtime |
| All management CRUD | CSR | Form interactions |

---

## Navigation & Access Control

```
/login                          → all staff
/register                       → public (creates manager + restaurant)
/r/{slug}/table/{qrToken}       → customer (public, resolves via QR)
/dashboard/{slug}/              → manager only
/dashboard/{slug}/menu          → manager + employee
/dashboard/{slug}/orders        → manager + employee
/dashboard/{slug}/kitchen       → manager + chef
/dashboard/{slug}/tables/qr     → manager only
/dashboard/{slug}/promotions    → manager only
/dashboard/{slug}/employees     → manager only
/dashboard/{slug}/reports       → manager only
/dashboard/{slug}/settings      → manager only
```

Middleware enforces via JWT `role` claim + `slug` match (Edge runtime, `jose`).

---

## Localization

- Primary language: Thai (ภาษาไทย)
- UI labels, notifications, and error messages in Thai
- Date format: ISO 8601 for API
- Currency: Thai Baht (฿), displayed as `฿1,234`
- Phone numbers: Thai format `0XX-XXX-XXXX`
