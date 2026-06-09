import { Elysia, t } from 'elysia'
import bcrypt from 'bcryptjs'
import { db } from '../db'
import { restaurants, tables, menus, users } from '../db/schema'
import { eq, or, desc, sql, count } from 'drizzle-orm'

export const PLAN_LIMITS: Record<string, { tables: number; menus: number; employees: number; promotions: number; price: number }> = {
  free:  { tables: 5,        menus: 20,        employees: 3,        promotions: 2,        price: 0   },
  basic: { tables: 20,       menus: 100,       employees: 15,       promotions: 10,       price: 299  },
  pro:   { tables: Infinity, menus: Infinity,  employees: Infinity, promotions: Infinity, price: 799 },
}
import { randomBytes } from 'crypto'
import { verifyJWT } from '../lib/jwt'
import { publisher, keys } from '../lib/redis'
import { requireSuperAdmin } from '../lib/auth'
import { checkRateLimit, getIP } from '../lib/rateLimit'
import { logAudit } from '../lib/audit'

export const restaurantRoutes = new Elysia({ prefix: '/restaurants' })

  // POST /restaurants/register
  .post('/register', async ({ body, request, set }) => {
    const limited = await checkRateLimit(keys.registerRateLimit(getIP(request)), 5, 3600)
    if (limited) {
      set.status = 429
      set.headers['Retry-After'] = '3600'
      return { error: 'Too many registration attempts. Please try again in 1 hour.' }
    }
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

    publisher.publish(keys.adminChannel(), JSON.stringify({
      type: 'NEW_RESTAURANT',
      restaurant: { id: restaurant.id, name: restaurant.name, slug: restaurant.slug, plan: 'free' },
      ts: Date.now(),
    }))
    logAudit('RESTAURANT_REGISTER', {
      restaurantId: restaurant.id,
      actorId: manager.id, actorName: manager.name, actorRole: 'manager',
      entityType: 'restaurant', entityId: restaurant.id,
      meta: { slug: restaurant.slug, name: restaurant.name },
      ip: getIP(request),
    })
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
    try { await requireSuperAdmin(token) } catch (e: any) { set.status = e.message === 'Forbidden' ? 403 : 401; return { error: e.message } }
    return db.select({
      id: restaurants.id, slug: restaurants.slug, name: restaurants.name,
      plan: restaurants.plan, is_active: restaurants.is_active, suspend_reason: restaurants.suspend_reason, created_at: restaurants.created_at,
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

  // GET /restaurants/billing  (super_admin)
  .get('/billing', async ({ headers, set }) => {
    const token = headers.authorization?.replace('Bearer ', '') ?? ''
    try { await requireSuperAdmin(token) } catch (e: any) { set.status = e.message === 'Forbidden' ? 403 : 401; return { error: e.message } }
    const summary = await db.select({
      plan: restaurants.plan,
      count: count(),
    }).from(restaurants).groupBy(restaurants.plan)
    const revenue = summary.reduce((acc, s) => {
      const price = PLAN_LIMITS[s.plan]?.price ?? 0
      return acc + (price * s.count)
    }, 0)
    return { summary, revenue, plans: PLAN_LIMITS }
  })

  // PATCH /restaurants/:id/toggle-active  (super_admin) — suspend / unsuspend
  .patch('/:id/toggle-active', async ({ headers, params, body, set }) => {
    const token = headers.authorization?.replace('Bearer ', '') ?? ''
    let adminPayload: any
    try { adminPayload = await requireSuperAdmin(token) } catch (e: any) { set.status = e.message === 'Forbidden' ? 403 : 401; return { error: e.message } }
    const [current] = await db.select({ is_active: restaurants.is_active, name: restaurants.name }).from(restaurants).where(eq(restaurants.id, params.id))
    if (!current) { set.status = 404; return { error: 'Not found' } }
    const willSuspend = current.is_active
    if (willSuspend && !(body as any)?.reason?.trim()) {
      set.status = 400; return { error: 'กรุณาระบุเหตุผลในการระงับ' }
    }
    const [updated] = await db.update(restaurants)
      .set({
        is_active: !current.is_active,
        suspend_reason: willSuspend ? (body as any).reason.trim() : null,
      })
      .where(eq(restaurants.id, params.id))
      .returning({ id: restaurants.id, name: restaurants.name, is_active: restaurants.is_active, suspend_reason: restaurants.suspend_reason })
    logAudit(willSuspend ? 'RESTAURANT_SUSPEND' : 'RESTAURANT_UNSUSPEND', {
      actorId: adminPayload?.userId, actorRole: 'super_admin',
      restaurantId: params.id,
      entityType: 'restaurant', entityId: params.id,
      meta: { restaurantName: current.name, reason: willSuspend ? (body as any)?.reason : undefined },
    })
    return updated
  }, {
    body: t.Optional(t.Object({ reason: t.Optional(t.String()) })),
  })

  // PATCH /restaurants/:id/plan  (super_admin)
  .patch('/:id/plan', async ({ headers, params, body, set }) => {
    const token = headers.authorization?.replace('Bearer ', '') ?? ''
    let adminPayload: any
    try { adminPayload = await requireSuperAdmin(token) } catch (e: any) { set.status = e.message === 'Forbidden' ? 403 : 401; return { error: e.message } }
    const [updated] = await db.update(restaurants)
      .set({ plan: body.plan as any })
      .where(eq(restaurants.id, params.id))
      .returning({ id: restaurants.id, name: restaurants.name, plan: restaurants.plan })
    if (!updated) { set.status = 404; return { error: 'Not found' } }
    logAudit('RESTAURANT_PLAN_CHANGE', {
      actorId: adminPayload?.userId, actorRole: 'super_admin',
      restaurantId: params.id,
      entityType: 'restaurant', entityId: params.id,
      meta: { restaurantName: updated.name, plan: body.plan },
    })
    return updated
  }, {
    body: t.Object({ plan: t.Union([t.Literal('free'), t.Literal('basic'), t.Literal('pro')]) }),
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
    const [tableCount] = await db.select({ count: count() }).from(tables).where(eq(tables.restaurant_id, r.id))
    const [menuCount]  = await db.select({ count: count() }).from(menus).where(eq(menus.restaurant_id, r.id))
    return {
      ...r,
      table_count: tableCount?.count ?? 0,
      menu_count:  menuCount?.count ?? 0,
      plan_limits: PLAN_LIMITS[r.plan] ?? PLAN_LIMITS.free,
    }
  })
