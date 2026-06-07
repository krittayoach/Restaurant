import { Elysia } from 'elysia'
import { t } from 'elysia'
import { db } from '../db'
import { reservations, tables, restaurants } from '../db/schema'
import { eq, and, gte, lte, ne, sql } from 'drizzle-orm'
import { verifyJWT } from '../lib/jwt'

async function requireManager(headers: any, set: any) {
  const auth = headers['authorization']
  if (!auth?.startsWith('Bearer ')) { set.status = 401; return null }
  try {
    const payload = await verifyJWT(auth.slice(7))
    if (!['manager', 'employee'].includes(payload.role)) { set.status = 403; return null }
    return payload
  } catch { set.status = 401; return null }
}

async function syncTableStatus(restaurantId: string) {
  const now = new Date()
  const windowStart = new Date(now.getTime() - 30 * 60_000)
  const windowEnd   = new Date(now.getTime() + 30 * 60_000)

  const due = await db.select({ table_id: reservations.table_id })
    .from(reservations)
    .where(and(
      eq(reservations.restaurant_id, restaurantId),
      eq(reservations.status, 'confirmed'),
      gte(reservations.reserved_at, windowStart),
      lte(reservations.reserved_at, windowEnd),
    ))

  for (const r of due) {
    await db.update(tables)
      .set({ status: 'reserved' })
      .where(and(eq(tables.id, r.table_id), eq(tables.status, 'available')))
  }
}

export const reservationRoutes = new Elysia({ prefix: '/reservations' })

  // Public: get available tables for a date/time/party_size
  .get('/public/:slug/tables', async ({ params, query, set }) => {
    const restaurant = await db.select({ id: restaurants.id })
      .from(restaurants)
      .where(eq(restaurants.slug, params.slug))
      .limit(1)
    if (!restaurant[0]) { set.status = 404; return { error: 'Restaurant not found' } }
    const rid = restaurant[0].id

    const requestedAt = new Date(`${query.date}T${query.time}`)
    if (isNaN(requestedAt.getTime())) { set.status = 400; return { error: 'Invalid date/time' } }

    const bufferStart = new Date(requestedAt.getTime() - 90 * 60_000)
    const bufferEnd   = new Date(requestedAt.getTime() + 90 * 60_000)

    const allTables = await db.select().from(tables)
      .where(and(eq(tables.restaurant_id, rid)))

    const blockedTableIds = new Set(
      (await db.select({ table_id: reservations.table_id })
        .from(reservations)
        .where(and(
          eq(reservations.restaurant_id, rid),
          ne(reservations.status, 'cancelled'),
          ne(reservations.status, 'no_show'),
          gte(reservations.reserved_at, bufferStart),
          lte(reservations.reserved_at, bufferEnd),
        ))
      ).map(r => r.table_id)
    )

    return allTables.filter(t =>
      t.seats >= parseInt(query.party_size) &&
      t.status !== 'occupied' &&
      !blockedTableIds.has(t.id)
    ).map(t => ({ id: t.id, label: t.label, seats: t.seats, status: t.status }))
  }, {
    params: t.Object({ slug: t.String() }),
    query:  t.Object({ date: t.String(), time: t.String(), party_size: t.String() }),
  })

  // Public: create reservation
  .post('/public/:slug', async ({ params, body, set }) => {
    const restaurant = await db.select({ id: restaurants.id })
      .from(restaurants)
      .where(eq(restaurants.slug, params.slug))
      .limit(1)
    if (!restaurant[0]) { set.status = 404; return { error: 'Restaurant not found' } }
    const rid = restaurant[0].id

    const reservedAt = new Date(`${body.date}T${body.time}`)
    if (isNaN(reservedAt.getTime())) { set.status = 400; return { error: 'Invalid date/time' } }

    const table = await db.select({ id: tables.id, seats: tables.seats })
      .from(tables)
      .where(and(eq(tables.id, body.table_id), eq(tables.restaurant_id, rid)))
      .limit(1)
    if (!table[0]) { set.status = 404; return { error: 'Table not found' } }
    if (table[0].seats < body.party_size) { set.status = 400; return { error: 'Table too small' } }

    const bufferStart = new Date(reservedAt.getTime() - 90 * 60_000)
    const bufferEnd   = new Date(reservedAt.getTime() + 90 * 60_000)
    const conflict = await db.select({ id: reservations.id })
      .from(reservations)
      .where(and(
        eq(reservations.table_id, body.table_id),
        ne(reservations.status, 'cancelled'),
        ne(reservations.status, 'no_show'),
        gte(reservations.reserved_at, bufferStart),
        lte(reservations.reserved_at, bufferEnd),
      ))
      .limit(1)
    if (conflict[0]) { set.status = 409; return { error: 'Table already reserved at this time' } }

    const [created] = await db.insert(reservations).values({
      restaurant_id:  rid,
      table_id:       body.table_id,
      customer_name:  body.customer_name,
      customer_phone: body.customer_phone,
      party_size:     body.party_size,
      reserved_at:    reservedAt,
      notes:          body.notes ?? null,
      status:         'confirmed',
    }).returning()

    set.status = 201
    return created
  }, {
    params: t.Object({ slug: t.String() }),
    body: t.Object({
      table_id:       t.String(),
      customer_name:  t.String({ minLength: 1 }),
      customer_phone: t.String({ minLength: 9 }),
      party_size:     t.Number({ minimum: 1 }),
      date:           t.String(),
      time:           t.String(),
      notes:          t.Optional(t.String()),
    }),
  })

  // Public: get single reservation (for confirmation page)
  .get('/public/booking/:id', async ({ params, set }) => {
    const [res] = await db.select({
      id:             reservations.id,
      customer_name:  reservations.customer_name,
      customer_phone: reservations.customer_phone,
      party_size:     reservations.party_size,
      reserved_at:    reservations.reserved_at,
      notes:          reservations.notes,
      status:         reservations.status,
      table_label:    tables.label,
      table_seats:    tables.seats,
    }).from(reservations)
      .innerJoin(tables, eq(reservations.table_id, tables.id))
      .where(eq(reservations.id, params.id))
      .limit(1)
    if (!res) { set.status = 404; return { error: 'Reservation not found' } }
    return res
  }, {
    params: t.Object({ id: t.String() }),
  })

  // Manager: list reservations by date
  .get('/', async ({ headers, query, set }) => {
    const payload = await requireManager(headers, set)
    if (!payload) return
    await syncTableStatus(payload.restaurantId!)

    const date = query.date ?? new Date().toISOString().slice(0, 10)
    const start = new Date(`${date}T00:00:00`)
    const end   = new Date(`${date}T23:59:59`)

    return db.select({
      id:             reservations.id,
      customer_name:  reservations.customer_name,
      customer_phone: reservations.customer_phone,
      party_size:     reservations.party_size,
      reserved_at:    reservations.reserved_at,
      notes:          reservations.notes,
      status:         reservations.status,
      table_label:    tables.label,
      table_id:       reservations.table_id,
    }).from(reservations)
      .innerJoin(tables, eq(reservations.table_id, tables.id))
      .where(and(
        eq(reservations.restaurant_id, payload.restaurantId!),
        gte(reservations.reserved_at, start),
        lte(reservations.reserved_at, end),
      ))
      .orderBy(reservations.reserved_at)
  }, {
    query: t.Object({ date: t.Optional(t.String()) }),
  })

  // Manager: update reservation status
  .patch('/:id', async ({ headers, params, body, set }) => {
    const payload = await requireManager(headers, set)
    if (!payload) return

    const [res] = await db.select()
      .from(reservations)
      .where(and(eq(reservations.id, params.id), eq(reservations.restaurant_id, payload.restaurantId!)))
      .limit(1)
    if (!res) { set.status = 404; return { error: 'Not found' } }

    const [updated] = await db.update(reservations)
      .set({ status: body.status })
      .where(eq(reservations.id, params.id))
      .returning()

    if (body.status === 'seated') {
      await db.update(tables).set({ status: 'occupied' }).where(eq(tables.id, res.table_id))
    } else if (body.status === 'cancelled' || body.status === 'no_show') {
      await db.update(tables)
        .set({ status: 'available' })
        .where(and(eq(tables.id, res.table_id), eq(tables.status, 'reserved')))
    }

    return updated
  }, {
    params: t.Object({ id: t.String() }),
    body:   t.Object({ status: t.Union([t.Literal('seated'), t.Literal('cancelled'), t.Literal('no_show')]) }),
  })
