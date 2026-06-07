import { Elysia, t } from 'elysia'
import bcrypt from 'bcryptjs'
import { db } from '../db'
import { restaurants, users, tables } from '../db/schema'
import { eq, or, desc } from 'drizzle-orm'
import { randomBytes } from 'crypto'
import { verifyJWT } from '../lib/jwt'

export const restaurantRoutes = new Elysia({ prefix: '/restaurants' })

  // POST /restaurants/register
  .post('/register', async ({ body, set }) => {
    const existing = await db.select().from(restaurants).where(eq(restaurants.slug, body.slug)).limit(1)
    if (existing.length > 0) { set.status = 400; return { error: 'Slug already taken' } }

    const [restaurant] = await db.insert(restaurants).values({
      slug: body.slug,
      name: body.name,
      promptpay: body.promptpay,
    }).returning()

    const hashedPw = await bcrypt.hash(body.password, 10)
    const [manager] = await db.insert(users).values({
      restaurant_id: restaurant.id,
      name: body.managerName,
      phone: body.phone,
      password: hashedPw,
      role: 'manager',
    }).returning()

    // Create 5 default tables
    const defaultTables = Array.from({ length: 5 }, (_, i) => ({
      restaurant_id: restaurant.id,
      label: `T${i + 1}`,
      seats: 4,
      qr_token: randomBytes(32).toString('hex'),
      qr_generated_at: new Date(),
    }))
    await db.insert(tables).values(defaultTables)

    return { restaurant: { id: restaurant.id, slug: restaurant.slug, name: restaurant.name }, manager: { id: manager.id, name: manager.name } }
  }, {
    body: t.Object({
      slug: t.String({ minLength: 3, maxLength: 60 }),
      name: t.String({ minLength: 1, maxLength: 100 }),
      managerName: t.String(),
      phone: t.String(),
      password: t.String({ minLength: 6 }),
      promptpay: t.Optional(t.String()),
    }),
  })

  // GET /restaurants/all  (super_admin only)
  .get('/all', async ({ headers, set }) => {
    const token = headers.authorization?.replace('Bearer ', '') ?? ''
    let payload: any
    try { payload = await verifyJWT(token) } catch { set.status = 401; return { error: 'Unauthorized' } }
    if (payload.role !== 'super_admin') { set.status = 403; return { error: 'Forbidden' } }
    return db.select({
      id: restaurants.id, slug: restaurants.slug, name: restaurants.name,
      plan: restaurants.plan, is_active: restaurants.is_active, created_at: restaurants.created_at,
    }).from(restaurants).orderBy(desc(restaurants.created_at))
  })

  // PATCH /restaurants/settings  (manager only)
  .patch('/settings', async ({ headers, body, set }) => {
    const token = headers.authorization?.replace('Bearer ', '') ?? ''
    let payload: any
    try { payload = await verifyJWT(token) } catch { set.status = 401; return { error: 'Unauthorized' } }
    if (payload.role !== 'manager') { set.status = 403; return { error: 'Forbidden' } }
    const [updated] = await db.update(restaurants).set({
      name: body.name,
      promptpay: body.promptpay ?? null,
      open_time: body.open_time ?? '08:00',
      close_time: body.close_time ?? '22:00',
    }).where(eq(restaurants.id, payload.restaurantId!)).returning()
    return updated
  }, {
    body: t.Object({
      name: t.String({ minLength: 1, maxLength: 100 }),
      promptpay: t.Optional(t.String()),
      open_time: t.Optional(t.String()),
      close_time: t.Optional(t.String()),
    }),
  })

  // GET /restaurants/:slug  (accepts slug or UUID)
  .get('/:slug', async ({ params, set }) => {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.slug)
    const [r] = await db.select().from(restaurants)
      .where(isUuid
        ? or(eq(restaurants.slug, params.slug), eq(restaurants.id, params.slug))
        : eq(restaurants.slug, params.slug))
      .limit(1)
    if (!r) { set.status = 404; return { error: 'Not found' } }
    return r
  })
