import { Elysia, t } from 'elysia'
import { db } from '../db'
import { orders, tables, users } from '../db/schema'
import { eq, and } from 'drizzle-orm'
import { verifyJWT } from '../lib/jwt'
import { redis, keys, publisher } from '../lib/redis'
import { checkRateLimit, getIP } from '../lib/rateLimit'
import { earnPoints, POINTS_PER_BAHT } from '../lib/loyalty'

async function handleEarnPoints(order: any) {
  if (!order.customer_id || order.total <= 0) return
  const [user] = await db.select({ phone: users.phone, name: users.name })
    .from(users).where(eq(users.id, order.customer_id)).limit(1)
  if (!user?.phone) return
  const pts = Math.floor(order.total * POINTS_PER_BAHT)
  if (pts > 0) await earnPoints(order.restaurant_id, user.phone, user.name, pts, 'order', order.id, `ออเดอร์ ฿${order.total.toFixed(0)}`)
}

async function requireAuth(headers: any, roles: string[], set: any) {
  const auth = headers['authorization']
  if (!auth?.startsWith('Bearer ')) { set.status = 401; return null }
  try {
    const payload = await verifyJWT(auth.slice(7))
    if (!roles.includes(payload.role)) { set.status = 403; return null }
    return payload
  } catch { set.status = 401; return null }
}

async function resetTable(tableId: string, restaurantId: string, orderId: string) {
  await db.update(tables).set({ status: 'available' }).where(eq(tables.id, tableId))
  await redis.del(keys.activeOrder(restaurantId, tableId))
}

export const paymentRoutes = new Elysia({ prefix: '/payment' })

  // POST /payment/request  (customer — no auth, orderId UUID is the secret)
  .post('/request', async ({ body, set, request }) => {
    const limited = await checkRateLimit(keys.paymentRateLimit(getIP(request)), 20, 600)
    if (limited) { set.status = 429; set.headers['Retry-After'] = '600'; return { error: 'Too many requests. Please try again later.' } }
    const [updated] = await db.update(orders)
      .set({ payment_method: body.method, payment_status: 'pending_verification' })
      .where(and(eq(orders.id, body.orderId), eq(orders.payment_status, 'unpaid')))
      .returning()
    if (!updated) { set.status = 404; return { error: 'Order not found or already submitted' } }
    await publisher.publish(
      keys.orderChannel(updated.restaurant_id),
      JSON.stringify({ type: 'PAYMENT_REQUESTED', data: { orderId: updated.id, method: body.method, tableId: updated.table_id } })
    )
    return { success: true }
  }, { body: t.Object({ orderId: t.String(), method: t.Union([t.Literal('cash'), t.Literal('promptpay')]) }) })

  // POST /payment/submit  (legacy — kept for compatibility)
  .post('/submit', async ({ body, set, request }) => {
    const limited = await checkRateLimit(keys.paymentRateLimit(getIP(request)), 20, 600)
    if (limited) { set.status = 429; set.headers['Retry-After'] = '600'; return { error: 'Too many requests. Please try again later.' } }
    const [updated] = await db.update(orders)
      .set({ payment_method: 'transfer', payment_status: 'pending_verification', slip_path: body.slipPath })
      .where(eq(orders.id, body.orderId)).returning()
    if (!updated) { set.status = 404; return { error: 'Order not found' } }
    return { success: true }
  }, { body: t.Object({ orderId: t.String(), slipPath: t.String() }) })

  // PATCH /payment/verify  (employee)
  .patch('/verify', async ({ headers, body, set }) => {
    const payload = await requireAuth(headers, ['employee', 'manager'], set)
    if (!payload) return
    const [order] = await db.update(orders).set({ payment_status: 'paid' }).where(eq(orders.id, body.orderId)).returning()
    if (!order) { set.status = 404; return { error: 'Not found' } }
    await resetTable(order.table_id, payload.restaurantId!, order.id)
    await publisher.publish(keys.tableChannel(payload.restaurantId!, order.table_id), JSON.stringify({ type: 'PAYMENT_VERIFIED', data: { orderId: order.id } }))
    await handleEarnPoints(order)
    return { success: true }
  }, { body: t.Object({ orderId: t.String() }) })

  // PATCH /payment/cash  (employee)
  .patch('/cash', async ({ headers, body, set }) => {
    const payload = await requireAuth(headers, ['employee', 'manager'], set)
    if (!payload) return
    const [order] = await db.update(orders).set({ payment_method: 'cash', payment_status: 'paid' }).where(eq(orders.id, body.orderId)).returning()
    if (!order) { set.status = 404; return { error: 'Not found' } }
    await resetTable(order.table_id, payload.restaurantId!, order.id)
    await publisher.publish(keys.tableChannel(payload.restaurantId!, order.table_id), JSON.stringify({ type: 'PAYMENT_VERIFIED', data: { orderId: order.id } }))
    await handleEarnPoints(order)
    return { success: true }
  }, { body: t.Object({ orderId: t.String() }) })

  // PATCH /payment/refund  (employee)
  .patch('/refund', async ({ headers, body, set }) => {
    const payload = await requireAuth(headers, ['employee', 'manager'], set)
    if (!payload) return
    await db.update(orders).set({ payment_status: 'refunded' }).where(eq(orders.id, body.orderId))
    return { success: true }
  }, { body: t.Object({ orderId: t.String() }) })
