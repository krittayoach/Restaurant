import { Elysia, t } from 'elysia'
import { db } from '../db'
import { reviews, orders } from '../db/schema'
import { eq, desc } from 'drizzle-orm'
import { verifyJWT } from '../lib/jwt'

async function requireAuth(headers: any, roles: string[], set: any) {
  const auth = headers['authorization']
  if (!auth?.startsWith('Bearer ')) { set.status = 401; return null }
  try {
    const payload = await verifyJWT(auth.slice(7))
    if (!roles.includes(payload.role)) { set.status = 403; return null }
    return payload
  } catch { set.status = 401; return null }
}

export const reviewRoutes = new Elysia({ prefix: '/reviews' })

  // POST /reviews  (customer — no auth, orderId is the secret)
  .post('/', async ({ body, set }) => {
    const [order] = await db.select({
      id: orders.id,
      restaurant_id: orders.restaurant_id,
      payment_status: orders.payment_status,
    }).from(orders).where(eq(orders.id, body.orderId)).limit(1)

    if (!order) { set.status = 404; return { error: 'Order not found' } }
    if (order.payment_status !== 'paid') { set.status = 400; return { error: 'Order not paid' } }

    const [existing] = await db.select({ id: reviews.id })
      .from(reviews).where(eq(reviews.order_id, body.orderId)).limit(1)
    if (existing) return { already: true }

    const [review] = await db.insert(reviews).values({
      restaurant_id: order.restaurant_id,
      order_id: body.orderId,
      rating: body.rating,
      comment: body.comment ?? null,
    }).returning()
    return review
  }, {
    body: t.Object({
      orderId: t.String(),
      rating: t.Integer({ minimum: 1, maximum: 5 }),
      comment: t.Optional(t.String()),
    }),
  })

  // GET /reviews  (manager)
  .get('/', async ({ headers, set }) => {
    const payload = await requireAuth(headers, ['manager'], set)
    if (!payload) return
    return db.select().from(reviews)
      .where(eq(reviews.restaurant_id, payload.restaurantId!))
      .orderBy(desc(reviews.created_at))
  })
