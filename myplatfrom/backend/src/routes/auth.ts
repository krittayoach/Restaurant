import { Elysia, t } from 'elysia'
import bcrypt from 'bcryptjs'
import { db } from '../db'
import { users, restaurants } from '../db/schema'
import { eq } from 'drizzle-orm'
import { signJWT, verifyJWT } from '../lib/jwt'
import { redis, keys, SESSION_TTL, RATE_LIMIT_TTL, RATE_LIMIT_MAX } from '../lib/redis'
import { checkRateLimit, getIP } from '../lib/rateLimit'
import { logAudit } from '../lib/audit'
import { sendEmail, tplEmailVerification, tplPasswordReset } from '../lib/email'
import { randomBytes } from 'crypto'

const APP_URL = process.env.APP_URL ?? 'http://localhost:3002'
const EMAIL_VERIFY_TTL = 86400  // 24h
const PASSWORD_RESET_TTL = 3600  // 1h

export const authRoutes = new Elysia({ prefix: '/auth' })

  // POST /auth/login
  .post('/login', async ({ body, request, set, cookie: { session } }) => {
    const ip = getIP(request)
    const limited = await checkRateLimit(keys.loginRateLimit(ip), RATE_LIMIT_MAX, RATE_LIMIT_TTL)
    if (limited) {
      set.status = 429
      set.headers['Retry-After'] = String(RATE_LIMIT_TTL)
      return { error: 'Too many login attempts. Try again in 5 minutes.' }
    }

    const [user] = await db.select().from(users).where(eq(users.email, body.email.toLowerCase().trim())).limit(1)
    if (!user || !user.password || !user.is_active) {
      logAudit('AUTH_LOGIN_FAILED', { meta: { email: body.email }, ip })
      set.status = 401
      return { error: 'Invalid credentials' }
    }

    if (!user.email_verified) {
      set.status = 403
      return { error: 'email_unverified', email: user.email }
    }

    const valid = await bcrypt.compare(body.password, user.password)
    if (!valid) {
      logAudit('AUTH_LOGIN_FAILED', { actorId: user.id, actorName: user.name, actorRole: user.role, restaurantId: user.restaurant_id, meta: { email: body.email }, ip })
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

    await redis.del(keys.loginRateLimit(ip))
    session.set({ value: token, httpOnly: true, sameSite: 'strict', maxAge: SESSION_TTL, path: '/' })

    let restaurantSlug: string | null = null
    if (user.restaurant_id) {
      const [rest] = await db.select({ slug: restaurants.slug }).from(restaurants).where(eq(restaurants.id, user.restaurant_id)).limit(1)
      restaurantSlug = rest?.slug ?? null
    }

    logAudit('AUTH_LOGIN', { actorId: user.id, actorName: user.name, actorRole: user.role, restaurantId: user.restaurant_id, ip })

    return { token, user: { id: user.id, name: user.name, role: user.role, restaurantId: user.restaurant_id, restaurantSlug } }
  }, {
    body: t.Object({ email: t.String(), password: t.String() }),
  })

  // POST /auth/customer
  .post('/customer', async ({ body, request, set, cookie: { customerSession } }) => {
    const limited = await checkRateLimit(keys.customerAuthRateLimit(getIP(request)), 30, 600)
    if (limited) {
      set.status = 429
      set.headers['Retry-After'] = '600'
      return { error: 'Too many requests. Please try again in 10 minutes.' }
    }
    const [existing] = await db.select().from(users).where(eq(users.phone, body.phone)).limit(1)
    let customer = existing

    if (!customer) {
      const [created] = await db.insert(users).values({
        name: body.name,
        phone: body.phone,
        role: 'customer',
        email: null,
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
    logAudit('AUTH_PASSWORD_CHANGE', { actorId: user.id, actorName: user.name, actorRole: user.role, restaurantId: user.restaurant_id })
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
    const [user] = await db.select().from(users).where(eq(users.email, body.email.toLowerCase().trim())).limit(1)
    if (!user) { set.status = 404; return { error: 'ไม่พบผู้ใช้งานนี้' } }
    await db.update(users).set({ password: await bcrypt.hash(body.newPassword, 10) }).where(eq(users.id, user.id))
    logAudit('AUTH_PASSWORD_RESET', {
      actorId: payload.userId, actorRole: 'super_admin',
      entityType: 'user', entityId: user.id,
      meta: { targetName: user.name, targetRole: user.role },
    })
    return { success: true, name: user.name, role: user.role }
  }, {
    body: t.Object({
      email: t.String(),
      newPassword: t.String({ minLength: 6 }),
    }),
  })

  // POST /auth/verify-email  (public)
  .post('/verify-email', async ({ body, set }) => {
    const userId = await redis.get(keys.emailVerifyToken(body.token))
    if (!userId) { set.status = 400; return { error: 'token_invalid' } }
    await db.update(users).set({ email_verified: true }).where(eq(users.id, userId))
    await redis.del(keys.emailVerifyToken(body.token))
    return { success: true }
  }, { body: t.Object({ token: t.String() }) })

  // POST /auth/resend-verification  (public)
  .post('/resend-verification', async ({ body, request, set }) => {
    const ip = getIP(request)
    const limited = await checkRateLimit(`ratelimit:resend-verify:${ip}`, 3, 600)
    if (limited) { set.status = 429; return { error: 'Too many requests. Try again in 10 minutes.' } }

    const [user] = await db.select({ id: users.id, name: users.name, email: users.email, email_verified: users.email_verified })
      .from(users).where(eq(users.email, body.email.toLowerCase().trim())).limit(1)
    if (!user || user.email_verified) return { success: true }  // silent — don't leak info

    const token = randomBytes(32).toString('hex')
    await redis.set(keys.emailVerifyToken(token), user.id, 'EX', EMAIL_VERIFY_TTL)
    const verifyUrl = `${APP_URL}/verify-email?token=${token}`
    sendEmail({ to: user.email!, ...tplEmailVerification(user.name, verifyUrl) })
    return { success: true }
  }, { body: t.Object({ email: t.String() }) })

  // POST /auth/forgot-password  (public — ส่ง reset link ทาง email)
  .post('/forgot-password', async ({ body, request, set }) => {
    const ip = getIP(request)
    const limited = await checkRateLimit(`ratelimit:forgot-password:${ip}`, 5, 600)
    if (limited) {
      set.status = 429
      set.headers['Retry-After'] = '600'
      return { error: 'Too many requests. Try again in 10 minutes.' }
    }

    const [user] = await db.select({ id: users.id, name: users.name, email: users.email, is_active: users.is_active })
      .from(users).where(eq(users.email, body.email.toLowerCase().trim())).limit(1)

    // silent — ไม่เปิดเผยว่า email มีในระบบหรือไม่
    if (!user || !user.is_active || !user.email) return { success: true }

    const token = randomBytes(32).toString('hex')
    await redis.set(keys.passwordResetToken(token), user.id, 'EX', PASSWORD_RESET_TTL)
    const resetUrl = `${APP_URL}/reset-password?token=${token}`
    sendEmail({ to: user.email, ...tplPasswordReset(user.name, resetUrl) })
    return { success: true }
  }, { body: t.Object({ email: t.String() }) })

  // POST /auth/confirm-reset  (public — ยืนยัน token + ตั้งรหัสผ่านใหม่)
  .post('/confirm-reset', async ({ body, set }) => {
    const userId = await redis.get(keys.passwordResetToken(body.token))
    if (!userId) { set.status = 400; return { error: 'token_invalid' } }
    await db.update(users).set({ password: await bcrypt.hash(body.password, 10) }).where(eq(users.id, userId))
    await redis.del(keys.passwordResetToken(body.token))
    return { success: true }
  }, {
    body: t.Object({ token: t.String(), password: t.String({ minLength: 6 }) }),
  })

  // POST /auth/switch-branch — manager switches into a branch context
  .post('/switch-branch', async ({ body, set, cookie: { session } }) => {
    const token = session?.value ?? ''
    let payload: any
    try { payload = await verifyJWT(token) } catch { set.status = 401; return { error: 'Unauthorized' } }
    if (payload.role !== 'manager') { set.status = 403; return { error: 'Forbidden' } }

    const [branch] = await db.select().from(restaurants).where(eq(restaurants.slug, body.branchSlug)).limit(1)
    if (!branch) { set.status = 404; return { error: 'ไม่พบสาขา' } }
    if (branch.parent_restaurant_id !== payload.restaurantId) { set.status = 403; return { error: 'Forbidden' } }
    if (!branch.is_active) { set.status = 403; return { error: 'สาขานี้ถูกปิดการใช้งาน' } }

    const newToken = await signJWT({ userId: payload.userId, restaurantId: branch.id, role: 'manager' })
    await redis.set(keys.session(newToken), JSON.stringify({ userId: payload.userId, restaurantId: branch.id, role: 'manager' }), 'EX', SESSION_TTL)
    session.set({ value: newToken, httpOnly: true, sameSite: 'strict', maxAge: SESSION_TTL, path: '/' })
    return { restaurantSlug: branch.slug }
  }, {
    body: t.Object({ branchSlug: t.String() }),
  })

  // POST /auth/switch-parent — manager returns to parent restaurant context
  .post('/switch-parent', async ({ set, cookie: { session } }) => {
    const token = session?.value ?? ''
    let payload: any
    try { payload = await verifyJWT(token) } catch { set.status = 401; return { error: 'Unauthorized' } }
    if (payload.role !== 'manager') { set.status = 403; return { error: 'Forbidden' } }

    const [current] = await db.select({ parent_restaurant_id: restaurants.parent_restaurant_id })
      .from(restaurants).where(eq(restaurants.id, payload.restaurantId!)).limit(1)
    if (!current?.parent_restaurant_id) { set.status = 400; return { error: 'ไม่ได้อยู่ในสาขา' } }

    const [parent] = await db.select({ id: restaurants.id, slug: restaurants.slug })
      .from(restaurants).where(eq(restaurants.id, current.parent_restaurant_id)).limit(1)

    const newToken = await signJWT({ userId: payload.userId, restaurantId: parent.id, role: 'manager' })
    await redis.set(keys.session(newToken), JSON.stringify({ userId: payload.userId, restaurantId: parent.id, role: 'manager' }), 'EX', SESSION_TTL)
    session.set({ value: newToken, httpOnly: true, sameSite: 'strict', maxAge: SESSION_TTL, path: '/' })
    return { restaurantSlug: parent.slug }
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
        logAudit('AUTH_LOGOUT', { actorId: (payload as any).userId, actorRole: (payload as any).role, restaurantId: (payload as any).restaurantId })
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
