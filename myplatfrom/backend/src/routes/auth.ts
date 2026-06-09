import { Elysia, t } from 'elysia'
import bcrypt from 'bcryptjs'
import { db } from '../db'
import { users, restaurants } from '../db/schema'
import { eq } from 'drizzle-orm'
import { signJWT, verifyJWT } from '../lib/jwt'
import { redis, keys, SESSION_TTL, RATE_LIMIT_TTL, RATE_LIMIT_MAX } from '../lib/redis'

export const authRoutes = new Elysia({ prefix: '/auth' })

  // POST /auth/login
  .post('/login', async ({ body, request, set, cookie: { session } }) => {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rateLimitKey = keys.loginRateLimit(ip)
    const attempts = await redis.incr(rateLimitKey)
    if (attempts === 1) await redis.expire(rateLimitKey, RATE_LIMIT_TTL)
    if (attempts > RATE_LIMIT_MAX) {
      set.status = 429
      return { error: 'Too many login attempts. Try again in 5 minutes.' }
    }

    const [user] = await db.select().from(users).where(eq(users.phone, body.phone)).limit(1)
    if (!user || !user.password || !user.is_active) {
      set.status = 401
      return { error: 'Invalid credentials' }
    }

    const valid = await bcrypt.compare(body.password, user.password)
    if (!valid) {
      set.status = 401
      return { error: 'Invalid credentials' }
    }

    const token = await signJWT({ userId: user.id, restaurantId: user.restaurant_id ?? null, role: user.role })

    // super_admin: invalidate previous session before creating new one
    if (user.role === 'super_admin') {
      const prevToken = await redis.get(keys.superAdminSession())
      if (prevToken) await redis.del(keys.session(prevToken))
      await redis.set(keys.superAdminSession(), token, 'EX', SESSION_TTL)
    }

    await redis.set(keys.session(token), JSON.stringify({ userId: user.id, restaurantId: user.restaurant_id, role: user.role }), 'EX', SESSION_TTL)

    await redis.del(rateLimitKey)
    session.set({ value: token, httpOnly: true, sameSite: 'strict', maxAge: SESSION_TTL, path: '/' })

    let restaurantSlug: string | null = null
    if (user.restaurant_id) {
      const [rest] = await db.select({ slug: restaurants.slug }).from(restaurants).where(eq(restaurants.id, user.restaurant_id)).limit(1)
      restaurantSlug = rest?.slug ?? null
    }

    return { token, user: { id: user.id, name: user.name, role: user.role, restaurantId: user.restaurant_id, restaurantSlug } }
  }, {
    body: t.Object({ phone: t.String(), password: t.String() }),
  })

  // POST /auth/customer
  .post('/customer', async ({ body, cookie: { customerSession } }) => {
    const [existing] = await db.select().from(users).where(eq(users.phone, body.phone)).limit(1)
    let customer = existing

    if (!customer) {
      const [created] = await db.insert(users).values({
        name: body.name,
        phone: body.phone,
        role: 'customer',
      }).returning()
      customer = created
    } else if (customer.name !== body.name) {
      await db.update(users).set({ name: body.name }).where(eq(users.id, customer.id))
    }

    const token = await signJWT({ userId: customer.id, restaurantId: null, role: 'customer' })
    customerSession.set({ value: token, httpOnly: true, sameSite: 'strict', maxAge: SESSION_TTL, path: '/' })

    return { token, customer: { id: customer.id, name: customer.name } }
  }, {
    body: t.Object({ name: t.String(), phone: t.String() }),
  })

  // PATCH /auth/change-password  (any authenticated user)
  .patch('/change-password', async ({ headers, body, set }) => {
    const auth = headers.authorization
    if (!auth?.startsWith('Bearer ')) { set.status = 401; return { error: 'Unauthorized' } }
    let payload: any
    try { payload = await verifyJWT(auth.slice(7)) } catch { set.status = 401; return { error: 'Unauthorized' } }
    const [user] = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1)
    if (!user?.password) { set.status = 404; return { error: 'User not found' } }
    const valid = await bcrypt.compare(body.currentPassword, user.password)
    if (!valid) { set.status = 400; return { error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' } }
    await db.update(users).set({ password: await bcrypt.hash(body.newPassword, 10) }).where(eq(users.id, user.id))
    return { success: true }
  }, {
    body: t.Object({
      currentPassword: t.String(),
      newPassword: t.String({ minLength: 6 }),
    }),
  })

  // PATCH /auth/reset-password  (super_admin only — สำหรับ reset รหัสผ่านให้ user)
  .patch('/reset-password', async ({ headers, body, set }) => {
    const auth = headers.authorization
    if (!auth?.startsWith('Bearer ')) { set.status = 401; return { error: 'Unauthorized' } }
    let payload: any
    try { payload = await verifyJWT(auth.slice(7)) } catch { set.status = 401; return { error: 'Unauthorized' } }
    if (payload.role !== 'super_admin') { set.status = 403; return { error: 'Forbidden' } }
    const [user] = await db.select().from(users).where(eq(users.phone, body.phone)).limit(1)
    if (!user) { set.status = 404; return { error: 'ไม่พบผู้ใช้งานนี้' } }
    await db.update(users).set({ password: await bcrypt.hash(body.newPassword, 10) }).where(eq(users.id, user.id))
    return { success: true, name: user.name, role: user.role }
  }, {
    body: t.Object({
      phone: t.String(),
      newPassword: t.String({ minLength: 6 }),
    }),
  })

  // POST /auth/logout
  .post('/logout', async ({ cookie: { session } }) => {
    const token = session.value
    if (token) {
      try {
        const payload = await verifyJWT(token)
        if ((payload as any).role === 'super_admin') {
          const current = await redis.get(keys.superAdminSession())
          if (current === token) await redis.del(keys.superAdminSession())
        }
      } catch {}
      await redis.del(keys.session(token))
      session.remove()
    }
    return { success: true }
  })

  // GET /auth/me
  .get('/me', async ({ headers, set }) => {
    const auth = headers.authorization
    if (!auth?.startsWith('Bearer ')) { set.status = 401; return { error: 'Unauthorized' } }
    const token = auth.slice(7)
    try {
      const payload = await verifyJWT(token)
      const sessionData = await redis.get(keys.session(token))
      if (!sessionData) { set.status = 401; return { error: 'Session expired' } }
      return payload
    } catch {
      set.status = 401
      return { error: 'Invalid token' }
    }
  })
