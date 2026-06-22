import { Elysia, t } from 'elysia'
import { db } from '../db'
import { promotions, restaurants } from '../db/schema'
import { eq, and, count, or, isNull, lte, gte } from 'drizzle-orm'
import { verifyJWT } from '../lib/jwt'
import { redis, keys } from '../lib/redis'
import { PLAN_LIMITS } from './restaurants'
import { sql } from 'drizzle-orm'

async function auth(headers: any, set: any) {
  const token = headers.authorization?.replace('Bearer ', '') ?? ''
  try { return await verifyJWT(token) } catch { set.status = 401; return null }
}

export const promotionRoutes = new Elysia({ prefix: '/promotions' })

  // Public: active promotions for a restaurant slug
  .get('/public/:slug', async ({ params, set }) => {
    const [restaurant] = await db.select({ id: restaurants.id })
      .from(restaurants).where(eq(restaurants.slug, params.slug)).limit(1)
    if (!restaurant) { set.status = 404; return { error: 'Not found' } }

    const now = new Date()
    return db.select({
      id: promotions.id, name: promotions.name,
      discount_pct: promotions.discount_pct, discount_amt: promotions.discount_amt,
      min_order: promotions.min_order,
    }).from(promotions).where(and(
      eq(promotions.restaurant_id, restaurant.id),
      eq(promotions.is_active, true),
      or(isNull(promotions.starts_at), lte(promotions.starts_at, now)),
      or(isNull(promotions.ends_at),   gte(promotions.ends_at,   now)),
    ))
  }, { params: t.Object({ slug: t.String() }) })

  .get('/', async ({ headers, query, set }) => {
    const user = await auth(headers, set); if (!user) return { error: 'Unauthorized' }
    const rid = (query as any).restaurantId ?? user.restaurantId
    if (!rid) { set.status = 400; return { error: 'restaurantId required' } }
    return db.select().from(promotions).where(eq(promotions.restaurant_id, rid))
  })

  .post('/', async ({ headers, body, set }) => {
    const user = await auth(headers, set); if (!user) return { error: 'Unauthorized' }
    if (user.role !== 'manager') { set.status = 403; return { error: 'Forbidden' } }
    const [rest] = await db.select({ plan: restaurants.plan }).from(restaurants).where(eq(restaurants.id, user.restaurantId!)).limit(1)
    const limit = PLAN_LIMITS[rest?.plan ?? 'free'].promotions
    const [{ count: promoCount }] = await db.select({ count: count() }).from(promotions).where(eq(promotions.restaurant_id, user.restaurantId!))
    if (promoCount >= limit) {
      set.status = 402
      return { error: 'Plan limit reached', plan: rest?.plan, limit, current: promoCount }
    }
    const [p] = await db.insert(promotions).values({
      restaurant_id: user.restaurantId!,
      name: body.name,
      discount_pct: body.discount_pct ?? 0,
      discount_amt: body.discount_amt ?? 0,
      min_order: body.min_order ?? 0,
      starts_at: body.starts_at ? new Date(body.starts_at) : null,
      ends_at: body.ends_at ? new Date(body.ends_at) : null,
      is_active: true,
    }).returning()
    return p
  }, {
    body: t.Object({
      name: t.String(),
      discount_pct: t.Optional(t.Number()),
      discount_amt: t.Optional(t.Number()),
      min_order: t.Optional(t.Number()),
      starts_at: t.Optional(t.String()),
      ends_at: t.Optional(t.String()),
    }),
  })

  .put('/:id', async ({ headers, params, body, set }) => {
    const user = await auth(headers, set); if (!user) return { error: 'Unauthorized' }
    if (user.role !== 'manager') { set.status = 403; return { error: 'Forbidden' } }
    const [updated] = await db.update(promotions).set({
      name: body.name,
      discount_pct: body.discount_pct ?? 0,
      discount_amt: body.discount_amt ?? 0,
      min_order: body.min_order ?? 0,
      starts_at: body.starts_at ? new Date(body.starts_at) : null,
      ends_at: body.ends_at ? new Date(body.ends_at) : null,
    }).where(and(eq(promotions.id, params.id), eq(promotions.restaurant_id, user.restaurantId!))).returning()
    if (!updated) { set.status = 404; return { error: 'Not found' } }
    return updated
  }, {
    body: t.Object({
      name: t.String(),
      discount_pct: t.Optional(t.Number()),
      discount_amt: t.Optional(t.Number()),
      min_order: t.Optional(t.Number()),
      starts_at: t.Optional(t.String()),
      ends_at: t.Optional(t.String()),
    }),
  })

  .patch('/:id/toggle', async ({ headers, params, set }) => {
    const user = await auth(headers, set); if (!user) return { error: 'Unauthorized' }
    const [p] = await db.select().from(promotions).where(and(eq(promotions.id, params.id), eq(promotions.restaurant_id, user.restaurantId!)))
    if (!p) { set.status = 404; return { error: 'Not found' } }
    const [updated] = await db.update(promotions).set({ is_active: !p.is_active }).where(eq(promotions.id, params.id)).returning()
    return updated
  })

  .delete('/:id', async ({ headers, params, set }) => {
    const user = await auth(headers, set); if (!user) return { error: 'Unauthorized' }
    await db.delete(promotions).where(and(eq(promotions.id, params.id), eq(promotions.restaurant_id, user.restaurantId!)))
    return { success: true }
  })
