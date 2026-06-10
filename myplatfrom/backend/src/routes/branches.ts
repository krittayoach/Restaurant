import { Elysia, t } from 'elysia'
import { db } from '../db'
import { restaurants, tables } from '../db/schema'
import { eq, count } from 'drizzle-orm'
import { verifyJWT } from '../lib/jwt'
import { randomBytes } from 'crypto'
import { PLAN_LIMITS } from './restaurants'

export const branchRoutes = new Elysia({ prefix: '/restaurants' })

  // GET /restaurants/:slug/branches
  .get('/:slug/branches', async ({ params, headers, set }) => {
    const token = headers.authorization?.replace('Bearer ', '') ?? ''
    let payload: any
    try { payload = await verifyJWT(token) } catch { set.status = 401; return { error: 'Unauthorized' } }
    if (payload.role !== 'manager') { set.status = 403; return { error: 'Forbidden' } }

    const [restaurant] = await db.select().from(restaurants).where(eq(restaurants.slug, params.slug)).limit(1)
    if (!restaurant) { set.status = 404; return { error: 'Not found' } }
    if (payload.restaurantId !== restaurant.id) { set.status = 403; return { error: 'Forbidden' } }

    const branches = await db.select({
      id: restaurants.id, name: restaurants.name, slug: restaurants.slug,
      is_active: restaurants.is_active, created_at: restaurants.created_at,
    }).from(restaurants).where(eq(restaurants.parent_restaurant_id, restaurant.id))

    const limit = PLAN_LIMITS[restaurant.plan]?.branches ?? 0
    return { branches, branch_limit: limit === Infinity ? -1 : limit }
  })

  // POST /restaurants/:slug/branches
  .post('/:slug/branches', async ({ params, headers, body, set }) => {
    const token = headers.authorization?.replace('Bearer ', '') ?? ''
    let payload: any
    try { payload = await verifyJWT(token) } catch { set.status = 401; return { error: 'Unauthorized' } }
    if (payload.role !== 'manager') { set.status = 403; return { error: 'Forbidden' } }

    const [restaurant] = await db.select().from(restaurants).where(eq(restaurants.slug, params.slug)).limit(1)
    if (!restaurant) { set.status = 404; return { error: 'Not found' } }
    if (payload.restaurantId !== restaurant.id) { set.status = 403; return { error: 'Forbidden' } }
    if (restaurant.parent_restaurant_id) { set.status = 400; return { error: 'ไม่สามารถสร้างสาขาของสาขาได้' } }

    const limit = PLAN_LIMITS[restaurant.plan]?.branches ?? 0
    if (limit !== Infinity) {
      const [{ count: branchCount }] = await db.select({ count: count() })
        .from(restaurants).where(eq(restaurants.parent_restaurant_id, restaurant.id))
      if (branchCount >= limit) {
        set.status = 403
        return { error: 'plan_limit', message: `แพ็กเกจ ${restaurant.plan} สร้างได้สูงสุด ${limit} สาขา — อัปเกรดแพ็กเกจเพื่อเพิ่มสาขา` }
      }
    }

    const [slugExists] = await db.select({ id: restaurants.id }).from(restaurants)
      .where(eq(restaurants.slug, body.slug)).limit(1)
    if (slugExists) { set.status = 400; return { error: 'Slug นี้ถูกใช้แล้ว' } }

    const [branch] = await db.insert(restaurants).values({
      parent_restaurant_id: restaurant.id,
      slug: body.slug,
      name: body.name,
      plan: restaurant.plan,
      promptpay: restaurant.promptpay,
    }).returning()

    const defaultTables = Array.from({ length: 3 }, (_, i) => ({
      restaurant_id: branch.id,
      label: `T${i + 1}`,
      seats: 4,
      qr_token: randomBytes(32).toString('hex'),
      qr_generated_at: new Date(),
    }))
    await db.insert(tables).values(defaultTables)

    return { branch: { id: branch.id, name: branch.name, slug: branch.slug } }
  }, {
    body: t.Object({
      name: t.String({ minLength: 1, maxLength: 100 }),
      slug: t.String({ minLength: 3, maxLength: 60 }),
    }),
  })

  // DELETE /restaurants/:slug/branches/:branchSlug — deactivate branch
  .delete('/:slug/branches/:branchSlug', async ({ params, headers, set }) => {
    const token = headers.authorization?.replace('Bearer ', '') ?? ''
    let payload: any
    try { payload = await verifyJWT(token) } catch { set.status = 401; return { error: 'Unauthorized' } }
    if (payload.role !== 'manager') { set.status = 403; return { error: 'Forbidden' } }

    const [restaurant] = await db.select().from(restaurants).where(eq(restaurants.slug, params.slug)).limit(1)
    if (!restaurant) { set.status = 404; return { error: 'Not found' } }
    if (payload.restaurantId !== restaurant.id) { set.status = 403; return { error: 'Forbidden' } }

    const [branch] = await db.select().from(restaurants).where(eq(restaurants.slug, params.branchSlug)).limit(1)
    if (!branch || branch.parent_restaurant_id !== restaurant.id) { set.status = 404; return { error: 'ไม่พบสาขา' } }

    await db.update(restaurants).set({ is_active: false }).where(eq(restaurants.id, branch.id))
    return { ok: true }
  })
