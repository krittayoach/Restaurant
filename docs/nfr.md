# Non-Functional Requirements (NFR)
## Restaurant SaaS Platform

---

## 1. Performance

| Requirement | Target | Measurement |
|---|---|---|
| API response time (p95) | < 300ms | ไม่รวม cold start |
| API response time (p99) | < 1,000ms | |
| SSE event delivery | < 500ms จาก publish ถึง client | Redis Pub/Sub latency |
| Page load (LCP) | < 2.5s | บน 4G mobile |
| Menu cache hit rate | > 90% | Redis cache TTL 5 min |
| DB query time (p95) | < 100ms | indexed queries |

**Baseline load:** 50 concurrent orders ต่อร้าน, 100 ร้าน = 5,000 concurrent users

---

## 2. Availability

| Requirement | Target |
|---|---|
| Uptime SLA | 99.5% (≈ 44h downtime/ปี) |
| Planned maintenance window | 02:00–04:00 น. (traffic ต่ำสุด) |
| Recovery Time Objective (RTO) | < 30 นาที |
| Recovery Point Objective (RPO) | < 1 ชั่วโมง (ข้อมูลที่ยอมสูญเสียได้) |
| KDS offline tolerance | ทำงานได้นาน 30 นาที เมื่อ net หลุด (PWA cache) |

---

## 3. Scalability

```
ปัจจุบัน (MVP)          Scale เป้าหมาย
─────────────────        ─────────────────────────────
1 backend instance   →   Horizontal scaling (Load Balancer)
~50 restaurants      →   1,000+ restaurants
~500 req/min         →   50,000 req/min
Single PostgreSQL    →   Read replicas + connection pool
Single Redis         →   Redis Cluster
```

**Bottleneck ที่คาดไว้:**
- SSE connections ต่อ process มีจำกัด → แก้ด้วย sticky session หรือ Redis Pub/Sub ทุก instance (รองรับแล้ว)
- PostgreSQL write contention เมื่อออเดอร์พร้อมกันมาก → แก้ด้วย connection pool (pgBouncer)

---

## 4. Security

| Requirement | Implementation |
|---|---|
| Authentication | JWT HS256 + Redis session (TTL 24h) |
| Authorization | Role-based (manager / employee / chef / customer) |
| Tenant isolation | `restaurant_id` ทุก query, มาจาก JWT เท่านั้น |
| QR token safety | 32-byte hex random, cross-check กับ slug |
| Password storage | bcrypt (salt rounds 10) |
| Transport | HTTPS (production) |
| CORS | Whitelist origin เท่านั้น |
| File upload | image/* เท่านั้น, ขนาดจำกัด 5MB |
| Public endpoints | `/r/*`, `/reservations/public/*` — ไม่ต้อง auth แต่ rate limit |
| Rate limiting | ยังไม่มี — **Phase 3 backlog** |
| Audit log | ยังไม่มี — **Phase 3 backlog** |

---

## 5. Reliability

| Requirement | Target |
|---|---|
| ข้อมูลออเดอร์ไม่สูญหาย | PostgreSQL ACID transactions |
| SSE reconnect อัตโนมัติ | `useSSE()` hook retry ทุก 3 วินาที |
| KDS offline queue | Action queue ใน localStorage → sync เมื่อ online |
| Redis unavailable | API ยังทำงานได้ (cache miss → query DB) |
| MinIO unavailable | Upload ล้มเหลว แต่ order flow ยังทำงานได้ |

---

## 6. Maintainability

| Requirement | Implementation |
|---|---|
| Code organization | Feature-based routes, shared lib/ |
| Type safety | TypeScript ทั้ง frontend และ backend |
| Schema migration | Drizzle ORM — `bun run db:push` |
| API documentation | Swagger auto-generated ที่ `/docs` |
| Seed data | `seed-demo.ts` สำหรับ dev/demo |
| Environment config | `.env` แยก dev/prod ชัดเจน |
| Logging | Console log ทุก request (production ควรใช้ structured logging) |

---

## 7. Usability

| Requirement | Target |
|---|---|
| Customer onboarding | สแกน QR → สั่งได้ภายใน 30 วินาที ไม่ต้องสมัครสมาชิก |
| Mobile-first | Responsive ทุกหน้า, tap target ≥ 44px |
| Language support | TH / EN toggle บนทุกหน้า customer-facing |
| Offline KDS | Chef ใช้งานได้เมื่อ net หลุด |
| Error feedback | Toast notification ทุก action |
| Loading state | Skeleton / spinner ทุก async operation |

---

## 8. Constraints

| Constraint | รายละเอียด |
|---|---|
| Runtime | Bun (ไม่ใช่ Node.js) — บาง npm package อาจไม่ compatible |
| Edge runtime | Next.js middleware ใช้ `jose` แทน `jsonwebtoken` (Web Crypto API) |
| Storage | MinIO self-hosted — ต้องตั้ง `forcePathStyle: true` |
| Plan limits | Free: 10 โต๊ะ / 30 เมนู, Basic: 20 โต๊ะ / 100 เมนู, Pro: ไม่จำกัด |
| Multi-tenant | 1 `restaurant_id` ต่อ JWT — ไม่รองรับ multi-branch ใน Phase นี้ |

---

## 9. Compliance & Data

| Requirement | รายละเอียด |
|---|---|
| ข้อมูลลูกค้า | เก็บเฉพาะ phone + name (ไม่เก็บ email, address) |
| ข้อมูล payment | เก็บแค่ slip image URL — ไม่เก็บข้อมูลบัตร |
| Data retention | ไม่มี auto-delete policy ใน Phase นี้ |
| PDPA | แจ้งลูกค้าผ่าน UI ก่อนเก็บข้อมูล — **Phase 3 backlog** |
