import { Elysia, t } from 'elysia'
import { db } from '../db'
import { tables } from '../db/schema'
import { eq, and } from 'drizzle-orm'
import { randomBytes } from 'crypto'
import { verifyJWT } from '../lib/jwt'
import { redis, keys, subscriber } from '../lib/redis'

async function requireAuth(headers: Record<string, string | undefined>, roles: string[], set: any) {
  const auth = headers['authorization']
  if (!auth?.startsWith('Bearer ')) { set.status = 401; return null }
  try {
    const payload = await verifyJWT(auth.slice(7))
    if (!roles.includes(payload.role)) { set.status = 403; return null }
    return payload
  } catch { set.status = 401; return null }
}

export const tableRoutes = new Elysia({ prefix: '/tables' })

  // GET /tables/resolve/:qrToken
  .get('/resolve/:qrToken', async ({ params, query, set }) => {
    const [table] = await db.select({
      id: tables.id, label: tables.label, seats: tables.seats,
      status: tables.status, restaurant_id: tables.restaurant_id,
    }).from(tables).where(eq(tables.qr_token, params.qrToken)).limit(1)

    if (!table) { set.status = 404; return { error: 'Invalid QR code' } }
    return table
  })

  // GET /tables
  .get('/', async ({ headers, set }) => {
    const payload = await requireAuth(headers as any, ['manager', 'employee', 'chef', 'super_admin'], set)
    if (!payload) return
    return db.select().from(tables).where(eq(tables.restaurant_id, payload.restaurantId!))
  })

  // POST /tables
  .post('/', async ({ headers, body, set }) => {
    const payload = await requireAuth(headers as any, ['manager'], set)
    if (!payload) return
    const [table] = await db.insert(tables).values({
      restaurant_id: payload.restaurantId!,
      label: body.label,
      seats: body.seats ?? 4,
    }).returning()
    return table
  }, { body: t.Object({ label: t.String(), seats: t.Optional(t.Integer()) }) })

  // PATCH /tables/:id/qr-token
  .patch('/:id/qr-token', async ({ headers, params, set }) => {
    const payload = await requireAuth(headers as any, ['manager'], set)
    if (!payload) return
    const token = randomBytes(32).toString('hex')
    const [updated] = await db.update(tables)
      .set({ qr_token: token, qr_generated_at: new Date() })
      .where(and(eq(tables.id, params.id), eq(tables.restaurant_id, payload.restaurantId!)))
      .returning()
    if (!updated) { set.status = 404; return { error: 'Table not found' } }
    return updated
  })

  // POST /tables/qr-token/bulk
  .post('/qr-token/bulk', async ({ headers, set }) => {
    const payload = await requireAuth(headers as any, ['manager'], set)
    if (!payload) return
    const allTables = await db.select({ id: tables.id }).from(tables).where(eq(tables.restaurant_id, payload.restaurantId!))
    for (const t of allTables) {
      await db.update(tables).set({ qr_token: randomBytes(32).toString('hex'), qr_generated_at: new Date() }).where(eq(tables.id, t.id))
    }
    return { updated: allTables.length }
  })

  // PATCH /tables/:id  (edit label/seats)
  .patch('/:id', async ({ headers, params, body, set }) => {
    const payload = await requireAuth(headers as any, ['manager'], set)
    if (!payload) return
    const [updated] = await db.update(tables)
      .set({ label: body.label, seats: body.seats })
      .where(and(eq(tables.id, params.id), eq(tables.restaurant_id, payload.restaurantId!)))
      .returning()
    if (!updated) { set.status = 404; return { error: 'Not found' } }
    return updated
  }, { body: t.Object({ label: t.Optional(t.String()), seats: t.Optional(t.Integer()) }) })

  // DELETE /tables/:id
  .delete('/:id', async ({ headers, params, set }) => {
    const payload = await requireAuth(headers as any, ['manager'], set)
    if (!payload) return
    await db.delete(tables).where(and(eq(tables.id, params.id), eq(tables.restaurant_id, payload.restaurantId!)))
    return { success: true }
  })

  // PATCH /tables/:id/status
  .patch('/:id/status', async ({ headers, params, body, set }) => {
    const payload = await requireAuth(headers as any, ['employee', 'manager'], set)
    if (!payload) return
    const [updated] = await db.update(tables)
      .set({ status: body.status })
      .where(and(eq(tables.id, params.id), eq(tables.restaurant_id, payload.restaurantId!)))
      .returning()
    if (!updated) { set.status = 404; return { error: 'Table not found' } }
    await redis.set(keys.tableStatus(payload.restaurantId!, params.id), body.status)
    return updated
  }, { body: t.Object({ status: t.Union([t.Literal('available'), t.Literal('occupied'), t.Literal('reserved'), t.Literal('cleaning')]) }) })

  // GET /tables/:tableId/stream?qrToken=xxx&slug=xxx  (public SSE for customer)
  .get('/:tableId/stream', async ({ params, query, set }) => {
    const table = await db.select().from(tables)
      .where(and(eq(tables.id, params.tableId), eq(tables.qr_token, query.qrToken)))
      .limit(1)
    if (table.length === 0) { set.status = 403; return { error: 'Forbidden' } }

    set.headers['content-type'] = 'text/event-stream'
    set.headers['cache-control'] = 'no-cache'
    set.headers['connection'] = 'keep-alive'

    const sub = subscriber.duplicate()
    const channel = keys.tableChannel(table[0].restaurant_id, params.tableId)
    await sub.subscribe(channel)

    return new ReadableStream({
      start(controller) {
        sub.on('message', (_, message) => {
          controller.enqueue(new TextEncoder().encode(`data: ${message}\n\n`))
        })
      },
      cancel() { sub.unsubscribe(channel); sub.disconnect() },
    })
  }, { query: t.Object({ qrToken: t.String() }) })
