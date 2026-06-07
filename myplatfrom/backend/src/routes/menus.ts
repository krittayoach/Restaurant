import { Elysia, t } from 'elysia'
import { db } from '../db'
import { menus } from '../db/schema'
import { eq, and } from 'drizzle-orm'
import { verifyJWT } from '../lib/jwt'
import { redis, keys, MENU_CACHE_TTL } from '../lib/redis'
import { uploadFile, getPublicUrl, menuImageKey } from '../lib/storage'

async function requireAuth(headers: any, roles: string[], set: any) {
  const auth = headers['authorization']
  if (!auth?.startsWith('Bearer ')) { set.status = 401; return null }
  try {
    const payload = await verifyJWT(auth.slice(7))
    if (!roles.includes(payload.role)) { set.status = 403; return null }
    return payload
  } catch { set.status = 401; return null }
}

async function invalidateCache(restaurantId: string) {
  await redis.del(keys.menuCache(restaurantId))
}

export const menuRoutes = new Elysia({ prefix: '/menus' })

  // POST /menus/image  (upload menu image → MinIO, return public URL)
  .post('/image', async ({ headers, body, set }) => {
    const payload = await requireAuth(headers, ['manager', 'employee'], set)
    if (!payload) return
    const file = body.image as File
    const key = menuImageKey(payload.restaurantId!, file.name)
    await uploadFile(key, await file.arrayBuffer(), file.type)
    return { url: getPublicUrl(key) }
  }, {
    body: t.Object({ image: t.File({ maxSize: 2 * 1024 * 1024 }) }),
  })

  // GET /menus  (public, cached)
  .get('/', async ({ query }) => {
    const restaurantId = query.restaurantId as string
    if (!restaurantId) return []

    const cached = await redis.get(keys.menuCache(restaurantId))
    if (cached) return JSON.parse(cached)

    const items = await db.select().from(menus)
      .where(and(eq(menus.restaurant_id, restaurantId), eq(menus.is_available, true), eq(menus.is_deleted, false)))
    await redis.set(keys.menuCache(restaurantId), JSON.stringify(items), 'EX', MENU_CACHE_TTL)
    return items
  })

  // GET /menus/all  (staff)
  .get('/all', async ({ headers, set }) => {
    const payload = await requireAuth(headers, ['manager', 'employee', 'chef'], set)
    if (!payload) return
    return db.select().from(menus).where(and(eq(menus.restaurant_id, payload.restaurantId!), eq(menus.is_deleted, false)))
  })

  // POST /menus
  .post('/', async ({ headers, body, set }) => {
    const payload = await requireAuth(headers, ['manager', 'employee'], set)
    if (!payload) return
    const [menu] = await db.insert(menus).values({ ...body, restaurant_id: payload.restaurantId! }).returning()
    await invalidateCache(payload.restaurantId!)
    return menu
  }, {
    body: t.Object({
      category_id: t.Optional(t.String()),
      name: t.String(), description: t.Optional(t.String()),
      price: t.Number(), image: t.Optional(t.String()),
      sort_order: t.Optional(t.Integer()),
    }),
  })

  // PUT /menus/:id
  .put('/:id', async ({ headers, params, body, set }) => {
    const payload = await requireAuth(headers, ['manager', 'employee'], set)
    if (!payload) return
    const [updated] = await db.update(menus).set(body)
      .where(and(eq(menus.id, params.id), eq(menus.restaurant_id, payload.restaurantId!)))
      .returning()
    if (!updated) { set.status = 404; return { error: 'Not found' } }
    await invalidateCache(payload.restaurantId!)
    return updated
  }, {
    body: t.Object({
      name: t.Optional(t.String()), description: t.Optional(t.String()),
      price: t.Optional(t.Number()), image: t.Optional(t.String()),
      category_id: t.Optional(t.String()), sort_order: t.Optional(t.Integer()),
    }),
  })

  // PATCH /menus/:id/toggle
  .patch('/:id/toggle', async ({ headers, params, set }) => {
    const payload = await requireAuth(headers, ['manager', 'employee'], set)
    if (!payload) return
    const [current] = await db.select({ is_available: menus.is_available }).from(menus).where(eq(menus.id, params.id)).limit(1)
    if (!current) { set.status = 404; return { error: 'Not found' } }
    const [updated] = await db.update(menus).set({ is_available: !current.is_available })
      .where(and(eq(menus.id, params.id), eq(menus.restaurant_id, payload.restaurantId!)))
      .returning()
    await invalidateCache(payload.restaurantId!)
    return updated
  })

  // PATCH /menus/reorder
  .patch('/reorder', async ({ headers, body, set }) => {
    const payload = await requireAuth(headers, ['manager', 'employee'], set)
    if (!payload) return
    for (const item of body.items) {
      await db.update(menus).set({ sort_order: item.sort_order }).where(and(eq(menus.id, item.id), eq(menus.restaurant_id, payload.restaurantId!)))
    }
    await invalidateCache(payload.restaurantId!)
    return { success: true }
  }, { body: t.Object({ items: t.Array(t.Object({ id: t.String(), sort_order: t.Integer() })) }) })

  // DELETE /menus/:id
  .delete('/:id', async ({ headers, params, set }) => {
    const payload = await requireAuth(headers, ['manager', 'employee'], set)
    if (!payload) return
    await db.update(menus).set({ is_deleted: true }).where(and(eq(menus.id, params.id), eq(menus.restaurant_id, payload.restaurantId!)))
    await invalidateCache(payload.restaurantId!)
    return { success: true }
  })
