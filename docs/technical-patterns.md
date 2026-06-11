# skills.md — Technical Skills & Patterns

## Backend (Elysia + Bun)

### Elysia Patterns
- Use `.group()` to namespace routes by domain (e.g., `/auth`, `/orders`, `/kitchen`)
- Use `.guard()` with `beforeHandle` for JWT validation and role checks
- Derive `restaurantId` and `userId` from JWT in a shared plugin, inject via `.decorate()` or `.derive()`
- Use Elysia's `t` (TypeBox) for request/response schema validation
- Return typed responses — Elysia infers OpenAPI (Swagger) from them automatically

### Authentication
- JWT signed with `JWT_SECRET`, payload: `{ userId, restaurantId, role }`
- Staff login uses **email** — `phone` reserved for walk-in customer loyalty only
- `email_verified` must be `true` before login; register sends verify link via Resend
- On login: store session in Redis `session:{token}` TTL 24h
- On logout: `DEL session:{token}`
- Middleware checks Redis key existence — enables instant token revocation

### Database (Drizzle ORM)
- Schema defined in `db/schema.ts` using Drizzle's table/column builders
- All tables include `restaurant_id uuid NOT NULL` for tenant isolation
- Use Drizzle's `eq`, `and`, `inArray` for queries — no raw SQL unless required
- Run migrations with `bun run db:push` (dev) or `drizzle-kit migrate` (prod)
- Use `snapshot` columns (`menu_name`, `unit_price` in `order_items`) to preserve historical data

### Redis Usage
```ts
// Session
await redis.set(`session:${token}`, JSON.stringify(payload), 'EX', 86400)
await redis.del(`session:${token}`)

// Menu cache
await redis.set(`cache:${restaurantId}:menus`, JSON.stringify(menus), 'EX', 300)
await redis.del(`cache:${restaurantId}:menus`)   // on menu CRUD

// Kitchen queue
await redis.lpush(`${restaurantId}:queue:kitchen`, orderId)

// Email verification (TTL 24h)
await redis.set(`email:verify:${token}`, userId, 'EX', 86400)
await redis.del(`email:verify:${token}`)   // on verify success

// Pub/Sub publish
await publisher.publish(`${restaurantId}:kitchen`, JSON.stringify({ type: 'NEW_ORDER', data }))
await publisher.publish(`${restaurantId}:order:update`, JSON.stringify({ type: 'PAYMENT_REQUESTED', data }))
```

### SSE (Server-Sent Events)
- Subscribe to Redis channel in SSE handler
- Return `text/event-stream` response
- Format: `data: ${JSON.stringify(payload)}\n\n`
- One SSE connection per staff session; channel scoped to `restaurantId`

---

## Frontend (Next.js 14 App Router)

### Routing Structure
```
app/
  r/[slug]/table/[qrToken]/        # Customer
    page.tsx                       # SSR — menu
    order/page.tsx                 # CSR — cart
    payment/page.tsx               # CSR — payment + review form
  staff/[slug]/
    page.tsx                       # SSE — Staff Display (employee/manager tablet)
  kds/[slug]/
    page.tsx                       # SSE — Kitchen Display (chef/manager)
  dashboard/[slug]/                # Staff
    kitchen/page.tsx               # SSE
    orders/page.tsx                # SSE
    menu/page.tsx                  # CSR
    tables/qr/page.tsx             # CSR
    promotions/page.tsx            # SSR
    employees/page.tsx             # CSR
    reports/page.tsx               # SSR
    page.tsx                       # SSR — overview
  login/page.tsx
  register/page.tsx
  verify-email/page.tsx            # Public — email verification landing
middleware.ts
```

### Middleware (Edge Runtime)
- Verify JWT using `jose` library (NOT `jsonwebtoken` — Node-only)
- Extract `role` and `restaurantId` from payload
- Redirect to `/login` if invalid/expired
- Check that `slug` in URL matches `restaurantId` in JWT

```ts
import { jwtVerify } from 'jose'
const secret = new TextEncoder().encode(process.env.JWT_SECRET)
const { payload } = await jwtVerify(token, secret)
```

### Data Fetching Patterns
- SSR pages: use `fetch()` with `cache: 'no-store'` or `next: { revalidate: 60 }`
- CSR pages: use SWR or React Query with `fetcher` hitting backend API
- SSE pages: `new EventSource('/api/kitchen/stream')` inside `useEffect`

### QR Customer Flow
1. `GET /tables/resolve/:qrToken?slug={slug}` → returns `{ tableId, restaurantId, tableName }`
2. Set `tableId` and `restaurantId` in httpOnly cookie via API route
3. Load menu from `GET /menus` (Redis cached)
4. Customer fills name + phone → `POST /auth/customer` → gets JWT
5. Submit order → `POST /orders`

---

## Database Enums (PostgreSQL)

```sql
role:              super_admin | manager | employee | chef | customer
table_status:      available | occupied | reserved | cleaning
order_status:      pending | cooking | ready | served | cancelled
order_item_status: pending | cooking | ready | served | cancelled
payment_method:    cash | transfer | promptpay
payment_status:    unpaid | pending_verification | paid | refunded
plan:              free | basic | pro
```

---

## Object Storage (Menu Images)

- Upload via presigned URL or server-side proxy
- Store only the path/key in DB (`menus.image`)
- Serve via CDN or signed URL at read time
- Accepted formats: JPEG, PNG, WebP for menu images
- หมายเหตุ: slip upload ถูกลบออกใน v2.12 — payment ใช้ QR PromptPay / เงินสด แทน

---

## Security Patterns

- Passwords hashed with bcrypt (salt rounds ≥ 10)
- Rate limit login: `ratelimit:login:{ip}` counter, TTL 5 min, max 5 attempts
- All cookies: `httpOnly`, `sameSite: strict`, `secure` in production
- Tenant isolation enforced at query level — never trust client-provided `restaurantId`
- QR token validation cross-checks `slug` param to prevent cross-restaurant access
