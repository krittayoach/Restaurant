import { Elysia, t } from 'elysia'
import { db } from '../db'
import { orders, orderItems, tables, promotions } from '../db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { verifyJWT } from '../lib/jwt'
import { redis, publisher, keys } from '../lib/redis'

async function requireAuth(headers: any, roles: string[], set: any) {
  const auth = headers['authorization']
  if (!auth?.startsWith('Bearer ')) { set.status = 401; return null }
  try {
    const payload = await verifyJWT(auth.slice(7))
    if (!roles.includes(payload.role)) { set.status = 403; return null }
    return payload
  } catch { set.status = 401; return null }
}

export const orderRoutes = new Elysia({ prefix: '/orders' })

  // POST /orders  (customer)
  .post('/', async ({ headers, body, set }) => {
    const payload = await requireAuth(headers, ['customer'], set)
    if (!payload) return

    // Calculate total
    const subtotal = body.items.reduce((sum: number, i: any) => sum + i.unit_price * i.quantity, 0)
    let discount = 0

    if (body.promotion_id) {
      const [promo] = await db.select().from(promotions).where(eq(promotions.id, body.promotion_id)).limit(1)
      if (promo && subtotal >= (promo.min_order ?? 0)) {
        discount = promo.discount_pct ? subtotal * (promo.discount_pct / 100) : (promo.discount_amt ?? 0)
      }
    }

    const [order] = await db.insert(orders).values({
      restaurant_id: body.restaurantId,
      table_id: body.tableId,
      customer_id: payload.userId,
      promotion_id: body.promotion_id,
      total: subtotal - discount,
      discount,
    }).returning()

    await db.insert(orderItems).values(
      body.items.map((i: any) => ({
        order_id: order.id,
        menu_id: i.menu_id,
        menu_name: i.menu_name,
        quantity: i.quantity,
        unit_price: i.unit_price,
        note: i.note,
      }))
    )

    // Update table status
    await db.update(tables).set({ status: 'occupied' }).where(eq(tables.id, body.tableId))
    await redis.set(keys.activeOrder(body.restaurantId, body.tableId), order.id)
    await redis.lpush(keys.kitchenQueue(body.restaurantId), order.id)
    await publisher.publish(keys.kitchenChannel(body.restaurantId), JSON.stringify({ type: 'NEW_ORDER', data: { orderId: order.id, tableId: body.tableId } }))

    return { orderId: order.id }
  }, {
    body: t.Object({
      restaurantId: t.String(),
      tableId: t.String(),
      promotion_id: t.Optional(t.String()),
      items: t.Array(t.Object({
        menu_id: t.Optional(t.String()),
        menu_name: t.String(),
        quantity: t.Integer(),
        unit_price: t.Number(),
        note: t.Optional(t.String()),
      })),
    }),
  })

  // GET /orders/pending-payment  (employee)
  .get('/pending-payment', async ({ headers, set }) => {
    const payload = await requireAuth(headers, ['employee', 'manager'], set)
    if (!payload) return
    return db.query.orders.findMany({
      where: and(
        eq(orders.restaurant_id, payload.restaurantId!),
        inArray(orders.payment_status, ['unpaid', 'pending_verification'])
      ),
      with: { table: true, items: true },
      orderBy: (o, { desc }) => [desc(o.created_at)],
    })
  })

  // POST /orders/:id/add-items  (customer — no auth, orderId is the secret)
  .post('/:id/add-items', async ({ params, body, set }) => {
    const [order] = await db.select().from(orders).where(eq(orders.id, params.id)).limit(1)
    if (!order) { set.status = 404; return { error: 'Order not found' } }
    if (['served', 'cancelled'].includes(order.status)) { set.status = 400; return { error: 'Order already closed' } }

    await db.insert(orderItems).values(
      body.items.map((i: any) => ({ order_id: params.id, menu_id: i.menu_id, menu_name: i.menu_name, quantity: i.quantity, unit_price: i.unit_price, note: i.note }))
    )
    const all = await db.select().from(orderItems).where(eq(orderItems.order_id, params.id))
    const newTotal = all.filter(i => i.status !== 'cancelled').reduce((s, i) => s + i.unit_price * i.quantity, 0)
    await db.update(orders).set({ total: newTotal }).where(eq(orders.id, params.id))
    await publisher.publish(keys.kitchenChannel(order.restaurant_id), JSON.stringify({ type: 'NEW_ORDER', data: { orderId: params.id } }))
    return { success: true }
  }, {
    body: t.Object({
      items: t.Array(t.Object({
        menu_id: t.Optional(t.String()), menu_name: t.String(),
        quantity: t.Integer(), unit_price: t.Number(), note: t.Optional(t.String()),
      })),
    }),
  })

  // PATCH /orders/:orderId/items/:itemId/cancel  (customer — no auth)
  .patch('/:orderId/items/:itemId/cancel', async ({ params, set }) => {
    const [item] = await db.select().from(orderItems)
      .where(and(eq(orderItems.id, params.itemId), eq(orderItems.order_id, params.orderId))).limit(1)
    if (!item) { set.status = 404; return { error: 'Item not found' } }
    if (item.status !== 'pending') { set.status = 400; return { error: 'Can only cancel pending items' } }

    await db.update(orderItems).set({ status: 'cancelled' }).where(eq(orderItems.id, params.itemId))
    const all = await db.select().from(orderItems).where(eq(orderItems.order_id, params.orderId))
    const newTotal = all.filter(i => i.id !== params.itemId && i.status !== 'cancelled').reduce((s, i) => s + i.unit_price * i.quantity, 0)
    await db.update(orders).set({ total: newTotal }).where(eq(orders.id, params.orderId))
    return { success: true }
  })

  // GET /orders/table/:tableId  (customer)
  .get('/table/:tableId', async ({ headers, params, query, set }) => {
    const restaurantId = query.restaurantId as string
    if (!restaurantId) { set.status = 400; return { error: 'Missing restaurantId' } }

    const orderList = await db.query.orders.findMany({
      where: and(eq(orders.table_id, params.tableId), eq(orders.restaurant_id, restaurantId)),
      with: { items: true },
      orderBy: (o, { desc }) => [desc(o.created_at)],
    })
    return orderList
  })

  // SSE /orders/stream  (employee)
  .get('/stream', async ({ headers, set }) => {
    const payload = await requireAuth(headers, ['employee', 'manager'], set)
    if (!payload) return

    set.headers['content-type'] = 'text/event-stream'
    set.headers['cache-control'] = 'no-cache'
    set.headers['connection'] = 'keep-alive'

    const { subscriber } = await import('../lib/redis')
    const sub = subscriber.duplicate()
    const channel = keys.orderChannel(payload.restaurantId!)
    await sub.subscribe(channel)

    return new ReadableStream({
      start(controller) {
        sub.on('message', (_, message) => {
          controller.enqueue(new TextEncoder().encode(`data: ${message}\n\n`))
        })
      },
      cancel() { sub.unsubscribe(channel); sub.disconnect() },
    })
  })
