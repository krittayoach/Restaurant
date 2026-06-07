import { Elysia, t } from 'elysia'
import { db } from '../db'
import { orders, orderItems, tables } from '../db/schema'
import { eq, and } from 'drizzle-orm'
import { verifyJWT } from '../lib/jwt'
import { publisher, keys } from '../lib/redis'

async function requireAuth(headers: any, roles: string[], set: any) {
  const auth = headers['authorization']
  if (!auth?.startsWith('Bearer ')) { set.status = 401; return null }
  try {
    const payload = await verifyJWT(auth.slice(7))
    if (!roles.includes(payload.role)) { set.status = 403; return null }
    return payload
  } catch { set.status = 401; return null }
}

async function syncOrderStatus(orderId: string, restaurantId: string) {
  const allItems = await db.select().from(orderItems).where(eq(orderItems.order_id, orderId))
  const active = allItems.filter(i => i.status !== 'cancelled')
  if (active.every(i => i.status === 'served')) {
    await db.update(orders).set({ status: 'served' }).where(eq(orders.id, orderId))
    return 'served'
  }
  return null
}

export const servingRoutes = new Elysia({ prefix: '/serving' })

  // GET /serving/tables
  .get('/tables', async ({ headers, set }) => {
    const payload = await requireAuth(headers, ['employee', 'manager'], set)
    if (!payload) return
    return db.query.tables.findMany({
      where: eq(tables.restaurant_id, payload.restaurantId!),
    })
  })

  // GET /serving/ready
  .get('/ready', async ({ headers, set }) => {
    const payload = await requireAuth(headers, ['employee', 'manager'], set)
    if (!payload) return
    return db.select().from(orderItems).where(eq(orderItems.status, 'ready'))
  })

  // PATCH /serving/items/:id/serve
  .patch('/items/:id/serve', async ({ headers, params, set }) => {
    const payload = await requireAuth(headers, ['employee', 'manager'], set)
    if (!payload) return
    const [updated] = await db.update(orderItems).set({ status: 'served', served_at: new Date() }).where(eq(orderItems.id, params.id)).returning()
    if (!updated) { set.status = 404; return { error: 'Not found' } }

    const newStatus = await syncOrderStatus(updated.order_id, payload.restaurantId!)
    await publisher.publish(keys.orderChannel(payload.restaurantId!), JSON.stringify({ type: 'ITEM_SERVED', data: { itemId: params.id, orderId: updated.order_id } }))
    if (newStatus === 'served') {
      await publisher.publish(keys.orderChannel(payload.restaurantId!), JSON.stringify({ type: 'ORDER_SERVED', data: { orderId: updated.order_id } }))
    }
    // Notify customer on table channel
    const [ord] = await db.select({ table_id: orders.table_id }).from(orders).where(eq(orders.id, updated.order_id)).limit(1)
    if (ord) await publisher.publish(keys.tableChannel(payload.restaurantId!, ord.table_id), JSON.stringify({ type: 'ITEM_SERVED', data: { itemId: params.id, orderId: updated.order_id } }))
    return updated
  })

  // POST /serving/orders/:id/add-items
  .post('/orders/:id/add-items', async ({ headers, params, body, set }) => {
    const payload = await requireAuth(headers, ['employee', 'manager'], set)
    if (!payload) return
    const newItems = await db.insert(orderItems).values(
      body.items.map((i: any) => ({ order_id: params.id, ...i }))
    ).returning()

    // Recalculate total
    const all = await db.select().from(orderItems).where(eq(orderItems.order_id, params.id))
    const newTotal = all.filter(i => i.status !== 'cancelled').reduce((s, i) => s + i.unit_price * i.quantity, 0)
    await db.update(orders).set({ total: newTotal }).where(eq(orders.id, params.id))

    await publisher.publish(keys.kitchenChannel(payload.restaurantId!), JSON.stringify({ type: 'NEW_ORDER', data: { orderId: params.id } }))
    return newItems
  }, {
    body: t.Object({
      items: t.Array(t.Object({
        menu_id: t.Optional(t.String()), menu_name: t.String(),
        quantity: t.Integer(), unit_price: t.Number(), note: t.Optional(t.String()),
      })),
    }),
  })

  // PATCH /serving/items/:id/cancel
  .patch('/items/:id/cancel', async ({ headers, params, set }) => {
    const payload = await requireAuth(headers, ['employee', 'manager'], set)
    if (!payload) return
    const [item] = await db.select().from(orderItems).where(eq(orderItems.id, params.id)).limit(1)
    if (!item) { set.status = 404; return { error: 'Not found' } }
    if (item.status !== 'pending') { set.status = 400; return { error: 'Can only cancel pending items' } }

    await db.update(orderItems).set({ status: 'cancelled' }).where(eq(orderItems.id, params.id))

    // Recalculate total
    const all = await db.select().from(orderItems).where(eq(orderItems.order_id, item.order_id))
    const newTotal = all.filter(i => i.id !== params.id && i.status !== 'cancelled').reduce((s, i) => s + i.unit_price * i.quantity, 0)
    await db.update(orders).set({ total: newTotal }).where(eq(orders.id, item.order_id))

    return { success: true }
  })
