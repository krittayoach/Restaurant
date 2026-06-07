import { Elysia, t } from 'elysia'
import { db } from '../db'
import { orders, tables } from '../db/schema'
import { eq } from 'drizzle-orm'
import { verifyJWT } from '../lib/jwt'
import { redis, keys, publisher } from '../lib/redis'

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

  // POST /payment/submit  (customer — no auth needed, orderId UUID is the secret)
  .post('/submit', async ({ body, set }) => {
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
    return { success: true }
  }, { body: t.Object({ orderId: t.String() }) })

  // PATCH /payment/refund  (employee)
  .patch('/refund', async ({ headers, body, set }) => {
    const payload = await requireAuth(headers, ['employee', 'manager'], set)
    if (!payload) return
    await db.update(orders).set({ payment_status: 'refunded' }).where(eq(orders.id, body.orderId))
    return { success: true }
  }, { body: t.Object({ orderId: t.String() }) })
