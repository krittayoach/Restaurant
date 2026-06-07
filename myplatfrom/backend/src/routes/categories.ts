import { Elysia, t } from 'elysia'
import { db } from '../db'
import { categories } from '../db/schema'
import { eq, and } from 'drizzle-orm'
import { verifyJWT } from '../lib/jwt'

async function requireAuth(headers: any, roles: string[], set: any) {
  const auth = headers['authorization']
  if (!auth?.startsWith('Bearer ')) { set.status = 401; return null }
  try {
    const payload = await verifyJWT(auth.slice(7))
    if (!roles.includes(payload.role)) { set.status = 403; return null }
    return payload
  } catch { set.status = 401; return null }
}

export const categoryRoutes = new Elysia({ prefix: '/categories' })

  .get('/', async ({ query }) => {
    const restaurantId = query.restaurantId as string
    if (!restaurantId) return []
    return db.select().from(categories).where(eq(categories.restaurant_id, restaurantId))
  })

  .post('/', async ({ headers, body, set }) => {
    const payload = await requireAuth(headers, ['manager', 'employee'], set)
    if (!payload) return
    const [cat] = await db.insert(categories).values({ ...body, restaurant_id: payload.restaurantId! }).returning()
    return cat
  }, { body: t.Object({ name: t.String(), sort_order: t.Optional(t.Integer()) }) })

  .put('/:id', async ({ headers, params, body, set }) => {
    const payload = await requireAuth(headers, ['manager', 'employee'], set)
    if (!payload) return
    const [updated] = await db.update(categories)
      .set({ name: body.name })
      .where(and(eq(categories.id, params.id), eq(categories.restaurant_id, payload.restaurantId!)))
      .returning()
    if (!updated) { set.status = 404; return { error: 'Not found' } }
    return updated
  }, { body: t.Object({ name: t.String() }) })

  .patch('/reorder', async ({ headers, body, set }) => {
    const payload = await requireAuth(headers, ['manager', 'employee'], set)
    if (!payload) return
    for (const item of body.items) {
      await db.update(categories).set({ sort_order: item.sort_order }).where(and(eq(categories.id, item.id), eq(categories.restaurant_id, payload.restaurantId!)))
    }
    return { success: true }
  }, { body: t.Object({ items: t.Array(t.Object({ id: t.String(), sort_order: t.Integer() })) }) })

  .delete('/:id', async ({ headers, params, set }) => {
    const payload = await requireAuth(headers, ['manager'], set)
    if (!payload) return
    await db.delete(categories).where(and(eq(categories.id, params.id), eq(categories.restaurant_id, payload.restaurantId!)))
    return { success: true }
  })
