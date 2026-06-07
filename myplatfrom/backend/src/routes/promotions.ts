import { Elysia, t } from 'elysia'
import { db } from '../db'
import { promotions } from '../db/schema'
import { eq, and } from 'drizzle-orm'
import { verifyJWT } from '../lib/jwt'
import { redis, keys } from '../lib/redis'

async function auth(headers: any, set: any) {
  const token = headers.authorization?.replace('Bearer ', '') ?? ''
  try { return await verifyJWT(token) } catch { set.status = 401; return null }
}

export const promotionRoutes = new Elysia({ prefix: '/promotions' })

  .get('/', async ({ headers, query, set }) => {
    const user = await auth(headers, set); if (!user) return { error: 'Unauthorized' }
    const rid = (query as any).restaurantId ?? user.restaurantId
    if (!rid) { set.status = 400; return { error: 'restaurantId required' } }
    return db.select().from(promotions).where(eq(promotions.restaurant_id, rid))
  })

  .post('/', async ({ headers, body, set }) => {
    const user = await auth(headers, set); if (!user) return { error: 'Unauthorized' }
    if (user.role !== 'manager') { set.status = 403; return { error: 'Forbidden' } }
    const b = body as any
    const [p] = await db.insert(promotions).values({
      restaurant_id: user.restaurantId!,
      name: b.name,
      discount_pct: b.discount_pct ?? 0,
      discount_amt: b.discount_amt ?? 0,
      min_order: b.min_order ?? 0,
      starts_at: b.starts_at ? new Date(b.starts_at) : null,
      ends_at: b.ends_at ? new Date(b.ends_at) : null,
      is_active: true,
    }).returning()
    return p
  })

  .put('/:id', async ({ headers, params, body, set }) => {
    const user = await auth(headers, set); if (!user) return { error: 'Unauthorized' }
    if (user.role !== 'manager') { set.status = 403; return { error: 'Forbidden' } }
    const b = body as any
    const [updated] = await db.update(promotions).set({
      name: b.name,
      discount_pct: b.discount_pct ?? 0,
      discount_amt: b.discount_amt ?? 0,
      min_order: b.min_order ?? 0,
      starts_at: b.starts_at ? new Date(b.starts_at) : null,
      ends_at: b.ends_at ? new Date(b.ends_at) : null,
    }).where(and(eq(promotions.id, params.id), eq(promotions.restaurant_id, user.restaurantId!))).returning()
    if (!updated) { set.status = 404; return { error: 'Not found' } }
    return updated
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
