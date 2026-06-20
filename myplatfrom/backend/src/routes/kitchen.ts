import { Elysia, t } from 'elysia'
import { db } from '../db'
import { orders, orderItems, menuIngredients, ingredients } from '../db/schema'
import { eq, and, inArray, sql } from 'drizzle-orm'
import { verifyJWT } from '../lib/jwt'
import { publisher, keys, subscriber } from '../lib/redis'
import { sendPushToTable } from '../lib/push'

async function requireAuth(headers: any, roles: string[], set: any) {
  const auth = headers['authorization']
  if (!auth?.startsWith('Bearer ')) { set.status = 401; return null }
  try {
    const payload = await verifyJWT(auth.slice(7))
    if (!roles.includes(payload.role)) { set.status = 403; return null }
    return payload
  } catch { set.status = 401; return null }
}

export const kitchenRoutes = new Elysia({ prefix: '/kitchen' })

  // GET /kitchen/queue
  .get('/queue', async ({ headers, set }) => {
    const payload = await requireAuth(headers, ['chef', 'manager'], set)
    if (!payload) return
    return db.query.orders.findMany({
      where: and(
        eq(orders.restaurant_id, payload.restaurantId!),
        inArray(orders.status, ['pending', 'cooking']),
      ),
      with: { items: true },
      orderBy: (o, { asc }) => [asc(o.created_at)],
    })
  })

  // GET /kitchen/stats
  .get('/stats', async ({ headers, set }) => {
    const payload = await requireAuth(headers, ['chef', 'manager'], set)
    if (!payload) return
    const allItems = await db.select().from(orderItems)
      .where(eq(orderItems.status, 'pending'))
    const cooking = await db.select().from(orderItems).where(eq(orderItems.status, 'cooking'))
    const ready = await db.select().from(orderItems).where(eq(orderItems.status, 'ready'))
    return { pending: allItems.length, cooking: cooking.length, ready: ready.length }
  })

  // PATCH /kitchen/items/:id/status
  .patch('/items/:id/status', async ({ headers, params, body, set }) => {
    const payload = await requireAuth(headers, ['chef', 'manager'], set)
    if (!payload) return

    const updates: Record<string, any> = { status: body.status }
    if (body.status === 'cooking') updates.started_at = new Date()
    if (body.status === 'ready')   updates.finished_at = new Date()

    const [updated] = await db.update(orderItems).set(updates).where(eq(orderItems.id, params.id)).returning()
    if (!updated) { set.status = 404; return { error: 'Item not found' } }

    // Auto-deduct inventory when item starts cooking
    if (body.status === 'cooking' && updated.menu_id) {
      const recipe = await db.select().from(menuIngredients)
        .where(eq(menuIngredients.menu_id, updated.menu_id))
      for (const r of recipe) {
        await db.update(ingredients)
          .set({ quantity: sql`GREATEST(0, ${ingredients.quantity} - ${r.quantity_per_unit * updated.quantity})` })
          .where(eq(ingredients.id, r.ingredient_id))
      }
    }

    // Sync order status
    const allItems = await db.select().from(orderItems).where(eq(orderItems.order_id, updated.order_id))
    const statuses = allItems.map(i => i.status)
    let orderStatus = 'pending'
    if (statuses.every(s => s === 'ready' || s === 'served')) orderStatus = 'ready'
    else if (statuses.some(s => s === 'cooking')) orderStatus = 'cooking'
    await db.update(orders).set({ status: orderStatus as any }).where(eq(orders.id, updated.order_id))

    await publisher.publish(keys.kitchenChannel(payload.restaurantId!), JSON.stringify({ type: 'ITEM_STATUS', data: { itemId: params.id, status: body.status, orderId: updated.order_id } }))
    if (body.status === 'ready') {
      await publisher.publish(keys.orderChannel(payload.restaurantId!), JSON.stringify({ type: 'ITEM_READY', data: { itemId: params.id, orderId: updated.order_id } }))
    }
    // Notify customer on table channel
    const [ord] = await db.select({ table_id: orders.table_id }).from(orders).where(eq(orders.id, updated.order_id)).limit(1)
    if (ord) {
      await publisher.publish(keys.tableChannel(payload.restaurantId!, ord.table_id), JSON.stringify({ type: 'ITEM_STATUS', data: { itemId: params.id, status: body.status, orderId: updated.order_id } }))
      // Web Push: แจ้งลูกค้าเมื่ออาหารพร้อมเสิร์ฟ (ทำงานแม้ปิดแท็บ)
      if (body.status === 'ready') {
        sendPushToTable(payload.restaurantId!, ord.table_id, {
          title: '🍽️ อาหารพร้อมเสิร์ฟแล้ว!',
          body: `${updated.menu_name} กำลังจะไปเสิร์ฟที่โต๊ะของคุณ`,
          tag: `ready-${updated.order_id}`,
        }).catch(() => {})
      }
    }

    return updated
  }, { body: t.Object({ status: t.Union([t.Literal('cooking'), t.Literal('ready')]) }) })

  // PATCH /kitchen/orders/:id/accept-all
  .patch('/orders/:id/accept-all', async ({ headers, params, set }) => {
    const payload = await requireAuth(headers, ['chef', 'manager'], set)
    if (!payload) return
    await db.update(orderItems).set({ status: 'cooking', started_at: new Date() })
      .where(and(eq(orderItems.order_id, params.id), eq(orderItems.status, 'pending')))
    await db.update(orders).set({ status: 'cooking' }).where(eq(orders.id, params.id))
    await publisher.publish(keys.kitchenChannel(payload.restaurantId!), JSON.stringify({ type: 'ORDER_ACCEPTED', data: { orderId: params.id } }))
    return { success: true }
  })

  // GET /kitchen/stream  (SSE)
  .get('/stream', async ({ headers, set }) => {
    const payload = await requireAuth(headers, ['chef', 'manager'], set)
    if (!payload) return

    set.headers['content-type'] = 'text/event-stream'
    set.headers['cache-control'] = 'no-cache'
    set.headers['connection'] = 'keep-alive'

    const sub = subscriber.duplicate()
    const channel = keys.kitchenChannel(payload.restaurantId!)
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
