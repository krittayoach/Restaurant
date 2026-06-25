import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { swagger } from '@elysiajs/swagger'
import { authRoutes } from './routes/auth'
import { restaurantRoutes } from './routes/restaurants'
import { tableRoutes } from './routes/tables'
import { menuRoutes } from './routes/menus'
import { categoryRoutes } from './routes/categories'
import { orderRoutes } from './routes/orders'
import { kitchenRoutes } from './routes/kitchen'
import { servingRoutes } from './routes/serving'
import { paymentRoutes } from './routes/payment'
import { employeeRoutes } from './routes/employees'
import { reportRoutes } from './routes/reports'
import { promotionRoutes } from './routes/promotions'
import { reservationRoutes } from './routes/reservations'
import { inventoryRoutes } from './routes/inventory'
import { billingRoutes } from './routes/billing'
import { customerRoutes } from './routes/customers'
import { adminRoutes } from './routes/admin'
import { auditLogRoutes } from './routes/auditLogs'
import { branchRoutes } from './routes/branches'
import { reviewRoutes } from './routes/reviews'
import { pushRoutes } from './routes/push'
import { rateLimitPlugin } from './lib/rateLimit'
import { startBillingCron } from './cron/billing'
import { logger } from './lib/logger'
import { initSentry, captureException } from './lib/sentry'
import { recordRequest, renderMetrics } from './lib/metrics'
import { db } from './db'
import { redis } from './lib/redis'
import { sql } from 'drizzle-orm'

initSentry()

const app = new Elysia()
  .use(cors({
    origin: ({ headers }) => {
      const origin = headers.get('origin') ?? ''
      const allowed = process.env.NEXT_PUBLIC_APP_URL ?? ''
      return origin.startsWith('http://localhost') || origin === allowed
    },
    credentials: true,
  }))
  .use(swagger({ path: '/docs' }))
  .use(rateLimitPlugin('global', 300, 60))

  // ── Request timing ──────────────────────────────────────────────────────────
  .derive(() => ({ startedAt: Date.now() }))
  .onAfterHandle(({ request, set, startedAt }) => {
    const path = new URL(request.url).pathname
    if (path === '/health' || path === '/metrics') return
    const status = typeof set.status === 'number' ? set.status : 200
    const duration = Date.now() - startedAt
    logger.info({ method: request.method, path, status, duration_ms: duration }, 'request')
    recordRequest(request.method, path, status, duration)
  })

  // ── Global error handler ────────────────────────────────────────────────────
  .onError(({ error, request, set, startedAt }) => {
    const path = new URL(request.url).pathname
    const status = typeof set.status === 'number' ? set.status : 500
    const duration = Date.now() - (startedAt ?? Date.now())
    logger.error({ method: request.method, path, status, duration_ms: duration, err: error }, 'request error')
    captureException(error, { method: request.method, path, status })
    recordRequest(request.method, path, status, duration)
    if ((status as number) >= 400) {
      if (set.status === 401) return { error: 'Unauthorized' }
      if (set.status === 403) return { error: 'Forbidden' }
      if (set.status === 404) return { error: 'Not found' }
      return { error: 'Request failed' }
    }
  })

  // ── Legacy onAfterHandle fallback (non-error 4xx) ──────────────────────────
  .onAfterHandle(({ response, set }) => {
    if ((response === undefined || response === null) && (set.status as number) >= 400) {
      if (set.status === 401) return { error: 'Unauthorized' }
      if (set.status === 403) return { error: 'Forbidden' }
      return { error: 'Request failed' }
    }
  })

  // ── Health check ────────────────────────────────────────────────────────────
  .get('/health', async () => {
    const [dbOk, redisOk] = await Promise.all([
      db.execute(sql`SELECT 1`).then(() => true).catch(() => false),
      redis.ping().then(r => r === 'PONG').catch(() => false),
    ])
    const status = dbOk && redisOk ? 'ok' : 'degraded'
    if (status === 'degraded') logger.warn({ db: dbOk, redis: redisOk }, 'health check degraded')
    return { status, checks: { db: dbOk, redis: redisOk }, uptime_s: Math.floor(process.uptime()), ts: new Date().toISOString() }
  })

  // ── Prometheus metrics ──────────────────────────────────────────────────────
  .get('/metrics', ({ set }) => {
    set.headers['Content-Type'] = 'text/plain; version=0.0.4; charset=utf-8'
    return renderMetrics()
  })

  .use(authRoutes)
  .use(restaurantRoutes)
  .use(tableRoutes)
  .use(menuRoutes)
  .use(categoryRoutes)
  .use(orderRoutes)
  .use(kitchenRoutes)
  .use(servingRoutes)
  .use(paymentRoutes)
  .use(employeeRoutes)
  .use(reportRoutes)
  .use(promotionRoutes)
  .use(reservationRoutes)
  .use(inventoryRoutes)
  .use(billingRoutes)
  .use(customerRoutes)
  .use(adminRoutes)
  .use(auditLogRoutes)
  .use(branchRoutes)
  .use(reviewRoutes)
  .use(pushRoutes)
  .listen(process.env.PORT ?? 3001)

logger.info(`🚀 Backend running at http://localhost:${app.server?.port}`)
logger.info(`📖 Swagger docs at http://localhost:${app.server?.port}/docs`)
if (process.env.SENTRY_DSN) logger.info('Sentry enabled')

startBillingCron()
