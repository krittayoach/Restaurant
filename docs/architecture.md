# Architecture — Restaurant SaaS Platform

## 1. System Overview

```mermaid
graph TB
    subgraph Client["Client Layer"]
        CUS["📱 Customer<br/>(QR Browser)"]
        STAFF["💻 Staff Dashboard<br/>(Manager / Employee)"]
        TABLET["📟 Staff Display<br/>(Employee / Manager Tablet)"]
        CHEF["🖥️ KDS<br/>(Chef / Fullscreen PWA)"]
        ADMIN["🔐 Super Admin"]
    end

    subgraph Frontend["Frontend — Next.js 14 (port 3002)"]
        MW["Middleware<br/>JWT Guard + Role Routing<br/>(Edge Runtime / jose)"]
        APP["App Router<br/>SSR + Client Components"]
        SW["Service Worker<br/>PWA Offline Cache"]
    end

    subgraph Backend["Backend — Elysia + Bun (port 3010)"]
        API["REST API<br/>17 Route Modules"]
        SSE["SSE Streams<br/>3 Channels per Restaurant"]
        AUTH["JWT Auth<br/>bcrypt + 24h session"]
    end

    subgraph Data["Data Layer"]
        PG[("PostgreSQL 16<br/>port 5433")]
        REDIS[("Redis 7<br/>port 6380<br/>Cache + Pub/Sub")]
        MINIO[("MinIO<br/>port 9000<br/>Images + Slips")]
    end

    CUS -->|"scan QR"| MW
    STAFF --> MW
    TABLET --> MW
    CHEF --> MW
    ADMIN --> MW
    MW --> APP
    APP <-->|"fetch / SSE"| API
    SW -.->|"offline cache"| CHEF
    API <--> AUTH
    API <--> PG
    API <--> REDIS
    API <--> MINIO
    REDIS -->|"Pub/Sub"| SSE
    SSE -->|"text/event-stream"| APP
```

---

## 2. Multi-Tenant Architecture

> แต่ละร้านใช้ฐานข้อมูลร่วมกัน (Shared Database) แต่ isolate ด้วย `restaurant_id` ทุก query

```mermaid
graph LR
    subgraph Tenant A["🍜 ร้าน A (slug: demo-restaurant)"]
        TA_MGR["Manager JWT<br/>restaurantId = AAA"]
        TA_DATA["tables / menus / orders<br/>WHERE restaurant_id = AAA"]
    end

    subgraph Tenant B["🍕 ร้าน B (slug: pizza-hut)"]
        TB_MGR["Manager JWT<br/>restaurantId = BBB"]
        TB_DATA["tables / menus / orders<br/>WHERE restaurant_id = BBB"]
    end

    subgraph SharedDB["PostgreSQL — Shared Database"]
        DB["restaurant_saas"]
    end

    TA_MGR -->|"restaurantId จาก JWT เท่านั้น<br/>ห้ามรับจาก body/query"| TA_DATA
    TB_MGR --> TB_DATA
    TA_DATA --> DB
    TB_DATA --> DB

    style TA_DATA fill:#fff7ed,stroke:#f97316
    style TB_DATA fill:#eff6ff,stroke:#3b82f6
```

**เหตุผลที่เลือก Shared DB แทน Schema-per-tenant:**
- ร้านส่วนใหญ่มี traffic ต่ำ — ไม่คุ้มค่า overhead
- Migration ทำครั้งเดียวทุก tenant
- ง่ายต่อการ query cross-tenant ในหน้า Super Admin

---

## 3. Realtime Order Flow

```mermaid
sequenceDiagram
    actor C as 📱 Customer
    participant FE as Next.js Frontend
    participant API as Elysia Backend
    participant DB as PostgreSQL
    participant PUB as Redis Publisher
    participant SUB as Redis Subscriber
    participant KDS as 🖥️ KDS (Chef)
    participant EMP as 💻 Employee

    C->>FE: เปิด QR → เลือกเมนู → กดสั่ง
    FE->>API: POST /orders
    API->>DB: INSERT orders + order_items
    API->>DB: UPDATE tables SET status='occupied'
    API->>PUB: PUBLISH {rid}:kitchen → NEW_ORDER
    PUB-->>SUB: broadcast
    SUB-->>KDS: SSE: NEW_ORDER 🔔
    SUB-->>EMP: SSE: NEW_ORDER

    Note over KDS: Chef เห็นออเดอร์ใหม่ทันที

    KDS->>API: PATCH /kitchen/items/:id (cooking)
    API->>DB: UPDATE order_items SET status='cooking'
    API->>PUB: PUBLISH {rid}:kitchen → ITEM_STATUS

    KDS->>API: PATCH /kitchen/items/:id (ready)
    API->>PUB: PUBLISH {rid}:order:update → ITEM_READY
    SUB-->>EMP: SSE: ITEM_READY 🔔

    EMP->>API: PATCH /serving/:orderId/serve
    API->>PUB: PUBLISH {rid}:table:{id} → ITEM_SERVED
    SUB-->>C: SSE: ITEM_SERVED ✅
```

---

## 4. Payment & Review Flow

```mermaid
sequenceDiagram
    actor C as 📱 Customer
    participant API as Backend
    participant DB as PostgreSQL
    participant PUB as Redis
    actor EMP as 💻 Employee / Staff Display

    C->>API: POST /payment/request { method: 'promptpay' | 'cash' }
    API->>DB: UPDATE orders SET payment_method, payment_status='pending_verification'
    API->>PUB: PUBLISH {rid}:order:update → PAYMENT_REQUESTED
    PUB-->>EMP: SSE: PAYMENT_REQUESTED 🔔

    Note over EMP: เห็น badge บนหน้า /payments และ Staff Display

    EMP->>API: PATCH /payment/verify
    API->>DB: UPDATE payment_status='paid'
    API->>DB: UPDATE tables SET status='available'
    API->>PUB: PUBLISH {rid}:table:{id} → PAYMENT_VERIFIED
    PUB-->>C: SSE: PAYMENT_VERIFIED ✅

    Note over API: earnPoints() — บันทึกแต้มสะสมลูกค้า

    C->>API: POST /reviews { orderId, rating, comment }
    Note over C: รีวิว 1-5 ดาว (ไม่ต้อง auth — orderId เป็น secret)
```

---

## 5. SSE Architecture

> เลือก SSE แทน WebSocket เพราะ traffic เป็น **server→client เท่านั้น** ไม่จำเป็นต้อง bidirectional

```mermaid
graph LR
    subgraph Channels["Redis Channels (per restaurant)"]
        K["{rid}:kitchen"]
        O["{rid}:order:update"]
        T["{rid}:table:{tableId}"]
    end

    subgraph Publishers
        ORDER["POST /orders"]
        KITCHEN["PATCH /kitchen"]
        PAYMENT["PATCH /payment"]
        SERVING["PATCH /serving"]
    end

    subgraph Subscribers["SSE Consumers"]
        KDS["KDS + Manager<br/>/kitchen/stream"]
        EMP["Employee + Staff Display<br/>/serving/stream"]
        CUS["Customer<br/>/tables/stream/:tableId"]
    end

    ORDER -->|"NEW_ORDER"| K
    KITCHEN -->|"ITEM_STATUS"| K
    KITCHEN -->|"ITEM_READY"| O
    SERVING -->|"ITEM_SERVED"| O
    SERVING -->|"ITEM_SERVED"| T
    PAYMENT -->|"PAYMENT_VERIFIED"| T
    PAYMENT -->|"PAYMENT_REQUESTED"| O

    K -->|"subscribe"| KDS
    O -->|"subscribe"| EMP
    T -->|"subscribe"| CUS

    style K fill:#fff7ed,stroke:#f97316
    style O fill:#eff6ff,stroke:#3b82f6
    style T fill:#f0fdf4,stroke:#22c55e
```

---

## 6. Entity Relationship Diagram

```mermaid
erDiagram
    restaurants ||--o{ users : "has"
    restaurants ||--o{ tables : "has"
    restaurants ||--o{ categories : "has"
    restaurants ||--o{ menus : "has"
    restaurants ||--o{ orders : "has"
    restaurants ||--o{ promotions : "has"
    restaurants ||--o{ reservations : "has"
    restaurants ||--o{ customers : "has"
    restaurants ||--o{ ingredients : "has"
    restaurants ||--o{ reviews : "has"

    categories ||--o{ menus : "groups"
    menus ||--o{ menu_ingredients : "uses"
    ingredients ||--o{ menu_ingredients : "used_in"

    tables ||--o{ orders : "has"
    tables ||--o{ reservations : "has"
    orders ||--o{ order_items : "contains"
    orders ||--o| reviews : "has"
    menus ||--o{ order_items : "referenced_by"
    promotions ||--o{ orders : "applied_to"

    customers ||--o{ point_transactions : "has"

    restaurants {
        uuid id PK
        varchar slug UK
        varchar name
        planEnum plan
        varchar promptpay
    }

    users {
        uuid id PK
        uuid restaurant_id FK
        varchar email UK
        boolean email_verified
        varchar phone "nullable — walk-in customers"
        roleEnum role
    }

    orders {
        uuid id PK
        uuid restaurant_id FK
        uuid table_id FK
        orderStatusEnum status
        paymentStatusEnum payment_status
        paymentMethodEnum payment_method
        real total
    }

    reviews {
        uuid id PK
        uuid restaurant_id FK
        uuid order_id FK
        integer rating
        text comment
    }

    reservations {
        uuid id PK
        uuid restaurant_id FK
        varchar customer_phone
        jsonb pre_order_items
        varchar pre_order_payment
    }

    customers {
        uuid id PK
        uuid restaurant_id FK
        varchar phone
        integer total_points
    }
```

---

## 7. Authentication & Authorization

```mermaid
flowchart TD
    REQ["HTTP Request"] --> MW{"Middleware\nNext.js Edge"}
    MW -->|"no token"| LOGIN["→ /login"]
    MW -->|"valid JWT"| ROLE{"role?"}

    ROLE -->|"manager"| DASH["Dashboard /dashboard/[slug]/*"]
    ROLE -->|"employee"| DASH
    ROLE -->|"manager/employee"| SDISP["Staff Display /staff/[slug]"]
    ROLE -->|"chef"| KDS["KDS /kds/[slug]"]
    ROLE -->|"customer"| ORDER["Order /r/[slug]/*"]
    ROLE -->|"super_admin"| ADMIN["Admin /admin"]

    DASH --> API_CALL["API Call + Bearer Token"]
    API_CALL --> BACKEND{"Backend\nverifyJWT()"}
    BACKEND -->|"restaurantId จาก JWT"| QUERY["DB Query\nWHERE restaurant_id = ?"]

    style LOGIN fill:#fef2f2,stroke:#ef4444
    style QUERY fill:#f0fdf4,stroke:#22c55e
```

---

## 8. Trade-offs & Design Decisions

| การตัดสินใจ | ที่เลือก | ทางเลือกอื่น | เหตุผล |
|---|---|---|---|
| Realtime | SSE | WebSocket | Traffic เป็น server→client เท่านั้น, ง่ายกว่า, reconnect built-in |
| Multi-tenant | Shared DB + `restaurant_id` | Schema per tenant | Scale เล็ก overhead ต่ำ migration ง่าย |
| Auth | JWT + Redis session | Session-only / OAuth | Stateless + revoke ได้ทันที (logout ลบ key) |
| Cache | Redis | In-memory / Memcached | ใช้อยู่แล้วสำหรับ Pub/Sub ลด dependency |
| ORM | Drizzle | Prisma / TypeORM | Type-safe, lightweight, SQL-like API เหมาะกับ Bun |
| Storage | MinIO (S3-compatible) | Cloudinary / local disk | Self-hosted, S3 API standard, ย้ายไป AWS S3 ได้ทันที |
| Runtime | Bun | Node.js | Performance สูงกว่า, built-in TypeScript |

---

## 9. Scalability Considerations

```mermaid
graph TB
    subgraph Current["ปัจจุบัน — Single Server"]
        BE1["Bun Backend"]
        FE1["Next.js"]
        DB1[("PostgreSQL")]
        R1[("Redis")]
    end

    subgraph Scale["เมื่อ Scale — Horizontal"]
        LB["Load Balancer"]
        BE2["Backend Instance 1"]
        BE3["Backend Instance 2"]
        FE2["Next.js (Vercel)"]
        DB2[("PostgreSQL\n+ Read Replicas")]
        R2[("Redis Cluster\nSSE Pub/Sub shared")]
    end

    Current -->|"traffic เพิ่ม"| Scale

    note1["⚠️ Bottleneck: SSE ต้องการ sticky session\nหรือ Redis Pub/Sub ทุก instance subscribe ร่วมกัน\n→ ปัจจุบันออกแบบรองรับแล้ว (Redis Pub/Sub)"]

    style note1 fill:#fff7ed,stroke:#f97316
```
