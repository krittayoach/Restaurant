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

const app = new Elysia()
  .use(cors({
    origin: ({ headers }) => {
      const origin = headers.get('origin') ?? ''
      // Allow any localhost port in dev, or the configured app URL in prod
      const allowed = process.env.NEXT_PUBLIC_APP_URL ?? ''
      return origin.startsWith('http://localhost') || origin === allowed
    },
    credentials: true,
  }))
  .use(swagger({ path: '/docs' }))
  .onAfterHandle(({ response, set }) => {
    if ((response === undefined || response === null) && (set.status as number) >= 400) {
      if (set.status === 401) return { error: 'Unauthorized' }
      if (set.status === 403) return { error: 'Forbidden' }
      return { error: 'Request failed' }
    }
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
  .get('/health', () => ({ status: 'ok', ts: new Date().toISOString() }))
  .listen(process.env.PORT ?? 3001)

console.log(`🚀 Backend running at http://localhost:${app.server?.port}`)
console.log(`📖 Swagger docs at http://localhost:${app.server?.port}/docs`)
