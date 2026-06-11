# 🍜 Restaurant SaaS Platform

ระบบจัดการร้านอาหาร Multi-tenant สำหรับร้านอาหารไทย  
ลูกค้าสั่งอาหารผ่าน QR Code → ครัวเห็นออเดอร์ Realtime → พนักงานจัดการ Floor และชำระเงิน

---

## ✨ ฟีเจอร์หลัก

### สำหรับลูกค้า
- **สั่งอาหารผ่าน QR Code** — ไม่ต้องโหลดแอป ไม่ต้องสมัครสมาชิก
- **ติดตามสถานะออเดอร์ Realtime** — เห็นทุกขั้นตอนตั้งแต่ครัวรับจนเสิร์ฟ
- **ชำระเงิน** — สแกน QR PromptPay หรือจ่ายเงินสด
- **รีวิวหลังชำระเงิน** — ให้คะแนน 1-5 ดาว + คอมเมนต์ (ไม่ต้องสมัครสมาชิก)
- **จองโต๊ะล่วงหน้า** — พร้อมสั่งอาหารล่วงหน้า (Pre-order)
- **ระบบสะสมแต้ม** — ทุก ฿10 = 1 แต้ม, จองโต๊ะ = 50 แต้ม, แลกเป็นส่วนลด
- **ดูแต้มและประวัติ** — ที่ `/r/[slug]/me` กรอกเบอร์โทรดูได้เลย
- **รองรับ 2 ภาษา** — TH / EN toggle

### สำหรับครัว
- **Kitchen Display System (KDS)** — หน้าจอ Fullscreen แสดงคิวออเดอร์ Realtime
- **อัปเดตสถานะ** — กด รับงาน → เสร็จแล้ว ทีละรายการหรือทั้งออเดอร์
- **PWA Offline** — ติดตั้งเป็นแอปได้, ทำงานได้แม้ net หลุด (auto-sync เมื่อ online)

### สำหรับพนักงาน
- **จัดการ Floor** — ดูสถานะโต๊ะ, เสิร์ฟอาหาร, ปิดออเดอร์
- **Staff Display (Tablet)** — `/staff/[slug]/` หน้าจอแท็บเล็ต Realtime แสดงอาหารพร้อมเสิร์ฟ + รอชำระเงิน
- **ยืนยันการชำระเงิน** — ยืนยัน QR PromptPay / รับเงินสด
- **หน้ารวมสลิปรอยืนยัน** — order slips + pre-order reservation slips ในที่เดียว

### สำหรับ Manager
- **จัดการเมนู** — CRUD พร้อมอัปโหลดรูป (MinIO)
- **โปรโมชั่น** — ลด % หรือลดจำนวน, กำหนดขั้นต่ำ
- **จัดการพนักงาน** — เพิ่ม/ลบด้วย email, ดูการเข้างาน, จ่ายเงินเดือน
- **คลังวัตถุดิบ** — ติดตามสต็อก, แจ้งเตือนของใกล้หมด
- **รายงาน** — รายได้รายวัน/รายเดือน, เมนูขายดี, Export CSV/PDF
- **การจองโต๊ะ** — ดู/จัดการ, อนุมัติสลิป Pre-order
- **แผน (Billing)** — ดู plan, อัปเกรด Free → Basic → Pro พร้อม plan limits (tables/menus/employees/promotions)

### สำหรับ Super Admin (`/admin`)
- **ภาพรวม Platform** — ร้านทั้งหมด, MRR, ร้านใหม่เดือนนี้
- **จัดการร้าน** — ค้นหา/กรอง, เปลี่ยน plan, ระงับ/เปิดใช้งาน (พร้อมเหตุผล), แสดงวันหมดอายุ plan
- **ยืนยันการชำระเงิน** — อนุมัติหรือปฏิเสธคำขออัปเกรด plan
- **Realtime Notifications** — แจ้งเตือนร้านใหม่และคำขออัปเกรดผ่าน SSE
- **Single-session enforcement** — login ใหม่ invalidate session เก่าทันที
- **Audit Log** — บันทึกการกระทำสำคัญทุกประเภท (login, suspend, billing, password reset ฯลฯ)

### Security & Infrastructure
- **Rate Limiting** — Redis-backed: global 300 req/min, login 5/5 min, register 5/hr
- **Billing Cron** — ตรวจสอบทุก 1 ชั่วโมง, auto-downgrade plan ที่หมดอายุ (30-day cycle)
- **Email Notifications** — แจ้งเตือนผ่าน Resend: อนุมัติ/ปฏิเสธ plan, หมดอายุ, 7-day reminder
- **Email Verification** — register ต้องยืนยัน email ก่อน login ได้; staff login ใช้ email (phone สำหรับ walk-in loyalty เท่านั้น)

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 14 App Router, TypeScript, Tailwind CSS v3 + design tokens |
| **Backend** | [Elysia](https://elysiajs.com/) + Bun |
| **Database** | PostgreSQL 16 + Drizzle ORM |
| **Cache / Realtime** | Redis 7 — Pub/Sub + Server-Sent Events (SSE) |
| **Storage** | MinIO (S3-compatible) — รูปเมนู, สลิป |
| **Auth** | JWT + Redis session |
| **PWA** | Service Worker — offline KDS |

---

## 🗂️ โครงสร้างโปรเจกต์

```
myplatfrom/
├── frontend/
│   └── app/
│       ├── r/[slug]/
│       │   ├── table/[qrToken]/    # ลูกค้า — สั่งอาหาร, ชำระเงิน
│       │   ├── reserve/            # ลูกค้า — จองโต๊ะ + Pre-order
│       │   └── me/                 # ลูกค้า — พอร์ทัลแต้มสะสม
│       ├── kds/[slug]/             # Kitchen Display System (Fullscreen PWA)
│       ├── staff/[slug]/           # Staff Display — ready-to-serve + payment (Tablet)
│       ├── verify-email/           # Email verification landing page
│       ├── dashboard/[slug]/       # Staff Dashboard
│       │   ├── (overview)          # ภาพรวม
│       │   ├── menu/               # จัดการเมนู
│       │   ├── orders/             # ออเดอร์ + ชำระเงิน
│       │   ├── kitchen/            # มอนิเตอร์ครัว
│       │   ├── tables/qr/          # QR โต๊ะ + จองโต๊ะ
│       │   ├── payments/           # รวมสลิปรอยืนยัน
│       │   ├── promotions/         # โปรโมชั่น
│       │   ├── employees/          # พนักงาน
│       │   ├── inventory/          # คลังวัตถุดิบ
│       │   ├── reports/            # รายงาน
│       │   └── settings/           # ตั้งค่าร้าน
│       └── admin/                  # Super Admin
├── backend/
│   └── src/
│       ├── routes/                 # auth, restaurants, menus, categories, tables
│       │                           # orders, kitchen, serving, payment, employees
│       │                           # reports, promotions, reservations, inventory
│       │                           # billing, customers, reviews
│       ├── db/
│       │   ├── schema.ts           # Drizzle schema ทั้งหมด
│       │   ├── index.ts            # DB connection
│       │   └── seed-demo.ts        # Demo seed data
│       └── lib/
│           ├── redis.ts            # Redis client + pub/sub
│           ├── jwt.ts              # JWT sign/verify
│           ├── auth.ts             # requireSuperAdmin() — JWT + Redis check
│           ├── storage.ts          # MinIO upload
│           └── loyalty.ts          # Points system
└── docker-compose.yml              # PostgreSQL + Redis + MinIO
```

---

## 🚀 เริ่มใช้งาน

### ความต้องการ
- [Bun](https://bun.sh/) >= 1.0
- [Docker](https://docker.com/) + Docker Compose

### 1. Clone & ติดตั้ง

```bash
git clone https://github.com/krittayoach/Restaurant.git
cd Restaurant/myplatfrom
bun install
cd backend && bun install
cd ../frontend && bun install
```

### 2. ตั้งค่า Environment

**`backend/.env`**
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/restaurant_saas
REDIS_URL=redis://localhost:6380
JWT_SECRET=your-secret-here
PORT=3010
PLATFORM_PROMPTPAY_ID=0812345678
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=restaurant-menu
# Email (optional — ใช้ Resend)
RESEND_API_KEY=re_xxxxxxxxxxxx
PLATFORM_EMAIL_FROM=noreply@yourdomain.com
APP_URL=http://localhost:3002
```

**`frontend/.env.local`**
```env
NEXT_PUBLIC_API_URL=http://localhost:3010
```

### 3. เริ่ม Services

```bash
# รัน PostgreSQL, Redis, MinIO
cd myplatfrom
docker compose up -d

# Push schema
cd backend
bun run db:push

# เพิ่ม demo data
bun run src/db/seed-demo.ts

# รัน backend (port 3010)
bun run dev

# รัน frontend (port 3002) — terminal ใหม่
cd ../frontend
bun run dev --port 3002
```

### 4. เปิดใช้งาน

| หน้า | URL |
|---|---|
| ลงทะเบียนร้านใหม่ | http://localhost:3002/register |
| Staff Login | http://localhost:3002/login |
| Dashboard | http://localhost:3002/dashboard/demo-restaurant |
| KDS ครัว | http://localhost:3002/kds/demo-restaurant |
| Staff Display (Tablet) | http://localhost:3002/staff/demo-restaurant |
| Super Admin | http://localhost:3002/admin |
| สั่งอาหาร (ลูกค้า) | สแกน QR จาก dashboard → QR โต๊ะ |
| จองโต๊ะ | http://localhost:3002/r/demo-restaurant/reserve |
| พอร์ทัลแต้ม | http://localhost:3002/r/demo-restaurant/me |

---

## 🔑 Demo Credentials

**Super Admin** (เข้าที่ `/admin`)

| Role | เบอร์ | รหัสผ่าน |
|---|---|---|
| Super Admin | `0800000000` | `password123` |

**ร้าน: demo-restaurant** (เข้าที่ `/login` — ใช้ email)

| Role | Email | รหัสผ่าน |
|---|---|---|
| Manager | `manager@demo.com` | `password123` |
| Employee | `employee1@demo.com` | `password123` |
| Employee | `employee2@demo.com` | `password123` |
| Chef | `chef1@demo.com` | `password123` |
| Chef | `chef2@demo.com` | `password123` |

### ลูกค้าทดสอบ (แต้มสะสม)

| ชื่อ | เบอร์ | แต้ม |
|---|---|---|
| คุณมาลี รักสวย | `0812222333` | 850 แต้ม |
| คุณสมชาย ใจดี | `0891234567` | 320 แต้ม |
| ครอบครัว จันทร์งาม | `0823456789` | 430 แต้ม |

---

## 🔄 Flow การทำงาน

```
ลูกค้า สแกน QR
    └─► เลือกเมนู + ใส่ตะกร้า + ยืนยัน
            └─► Backend สร้าง Order
                    ├─► Redis Pub/Sub → SSE → KDS (ครัว)
                    └─► ครัว: รับงาน → ทำ → เสร็จ → SSE → พนักงาน / Staff Display
                                                └─► พนักงาน เสิร์ฟ
                                                        └─► ลูกค้า ชำระเงิน (QR PromptPay / เงินสด)
                                                                └─► พนักงาน ยืนยัน → แต้มสะสม
                                                                        └─► ลูกค้า รีวิว ★★★★★
```

---

## 📡 API Endpoints

| Prefix | เนื้อหา |
|---|---|
| `POST /restaurants/register` | สมัครเปิดร้านใหม่ |
| `POST /auth/login` | เข้าสู่ระบบ |
| `/menus`, `/categories` | จัดการเมนู |
| `/tables` | จัดการโต๊ะ + สร้าง QR token |
| `/orders` | สั่งอาหาร, เพิ่มรายการ, ยกเลิก |
| `/kitchen` | คิวครัว, อัปเดตสถานะรายการ |
| `/serving` | เสิร์ฟอาหาร |
| `/payment` | request (QR/cash), ยืนยัน |
| `/reviews` | รีวิวหลังชำระเงิน (no-auth), GET (manager) |
| `/reservations` | จองโต๊ะ, อนุมัติ pre-order |
| `/customers` | lookup แต้ม, ประวัติ |
| `/employees` | จัดการพนักงาน, เงินเดือน |
| `/inventory` | คลังวัตถุดิบ |
| `/reports` | รายงานรายได้, เมนูขายดี |
| `/promotions` | โปรโมชั่น |
| `/billing` | แผนราคา, อัปเกรด plan |
| `/admin/*` | Super admin — จัดการร้าน, MRR, ระงับร้าน |
| `/audit-logs` | บันทึก audit (super_admin: ทั้งหมด, manager: เฉพาะร้านตัวเอง) |

Swagger UI: http://localhost:3010/docs

---

## 🗄️ Database Schema (สรุป)

```
restaurants ──< users (manager/employee/chef) — login ด้วย email
            ──< tables ──< orders ──< order_items
            │                    └──< reviews
            ──< categories ──< menus ──< menu_ingredients ──< ingredients
            ──< promotions
            ──< reservations
            ──< customers ──< point_transactions  (walk-in, ใช้ phone)
            ──< plan_payments
            ──< audit_logs
```

---

## 🎭 Roles & สิทธิ์

| Role | Dashboard | สั่งอาหาร | ครัว | ชำระเงิน | จัดการพนักงาน | รายงาน |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| `super_admin` | `/admin` | - | - | - | - | - |
| `manager` | ✅ | - | ✅ | ✅ | ✅ | ✅ |
| `employee` | ✅ | - | - | ✅ | - | - |
| `chef` | KDS เท่านั้น | - | ✅ | - | - | - |
| `customer` | - | ✅ | - | ✅ | - | - |

**Plan Limits**

| Plan | โต๊ะ | เมนู | พนักงาน | โปรโมชั่น | ราคา/เดือน |
|---|:---:|:---:|:---:|:---:|:---:|
| Free | 5 | 20 | 3 | 2 | ฟรี |
| Basic | 20 | 100 | 15 | 10 | ฿299 |
| Pro | ∞ | ∞ | ∞ | ∞ | ฿799 |

---

## 📦 Ports

| Service | Port |
|---|---|
| Frontend | 3002 |
| Backend | 3010 |
| PostgreSQL | 5433 |
| Redis | 6380 |
| MinIO API | 9000 |
| MinIO Console | 9001 |

---

## 🔧 Scripts ที่มีประโยชน์

```bash
# Backend
bun run dev          # รัน development server
bun run db:push      # push schema ไป database
bun run db:studio    # เปิด Drizzle Studio (GUI database)
bun run src/db/seed-demo.ts  # เพิ่ม demo data

# Frontend
bun run dev --port 3002   # รัน frontend
bun run build             # build production
npx tsc --noEmit          # type check (ใช้แทน build ระหว่าง dev)
```

---

## 📄 License

MIT
