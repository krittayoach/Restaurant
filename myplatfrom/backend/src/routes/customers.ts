import { Elysia, t } from 'elysia'
import { db } from '../db'
import { customers, pointTransactions, reservations, tables, restaurants } from '../db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { POINTS_PER_BAHT, POINTS_PER_RESERVATION, MIN_REDEEM_POINTS, BAHT_PER_POINT } from '../lib/loyalty'

export const customerRoutes = new Elysia({ prefix: '/customers' })

  // GET /customers/lookup?slug=&phone=  (public)
  .get('/lookup', async ({ query, set }) => {
    const [restaurant] = await db.select({ id: restaurants.id, name: restaurants.name })
      .from(restaurants).where(eq(restaurants.slug, query.slug)).limit(1)
    if (!restaurant) { set.status = 404; return { error: 'Restaurant not found' } }

    const rid = restaurant.id
    const phone = query.phone.replace(/\D/g, '')

    const [customer] = await db.select().from(customers)
      .where(and(eq(customers.restaurant_id, rid), eq(customers.phone, phone)))
      .limit(1)

    if (!customer) {
      return {
        found: false,
        restaurant: { name: restaurant.name },
        meta: { pointsPerBaht: POINTS_PER_BAHT, minRedeem: MIN_REDEEM_POINTS, bahtPerPoint: BAHT_PER_POINT, pointsPerReservation: POINTS_PER_RESERVATION },
      }
    }

    const [txns, resv] = await Promise.all([
      db.select().from(pointTransactions)
        .where(eq(pointTransactions.customer_id, customer.id))
        .orderBy(desc(pointTransactions.created_at))
        .limit(30),

      db.select({
        id:                reservations.id,
        reserved_at:       reservations.reserved_at,
        party_size:        reservations.party_size,
        status:            reservations.status,
        notes:             reservations.notes,
        table_label:       tables.label,
        pre_order_items:   reservations.pre_order_items,
        pre_order_total:   reservations.pre_order_total,
        pre_order_payment: reservations.pre_order_payment,
      }).from(reservations)
        .innerJoin(tables, eq(reservations.table_id, tables.id))
        .where(and(eq(reservations.restaurant_id, rid), eq(reservations.customer_phone, phone)))
        .orderBy(desc(reservations.reserved_at))
        .limit(10),
    ])

    return {
      found: true,
      customer: { id: customer.id, name: customer.name, phone: customer.phone, total_points: customer.total_points },
      restaurant: { name: restaurant.name },
      transactions: txns,
      reservations: resv,
      meta: { pointsPerBaht: POINTS_PER_BAHT, minRedeem: MIN_REDEEM_POINTS, bahtPerPoint: BAHT_PER_POINT, pointsPerReservation: POINTS_PER_RESERVATION },
    }
  }, {
    query: t.Object({ slug: t.String(), phone: t.String() }),
  })

  // GET /customers/points?restaurantId=&phone=  (public — used by order page)
  .get('/points', async ({ query }) => {
    const phone = query.phone.replace(/\D/g, '')
    const [customer] = await db.select({ total_points: customers.total_points, name: customers.name })
      .from(customers)
      .where(and(eq(customers.restaurant_id, query.restaurantId), eq(customers.phone, phone)))
      .limit(1)
    return { total_points: customer?.total_points ?? 0, name: customer?.name ?? null }
  }, {
    query: t.Object({ restaurantId: t.String(), phone: t.String() }),
  })
