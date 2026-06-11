import { Elysia, t } from 'elysia'
import bcrypt from 'bcryptjs'
import { db } from '../db'
import { users, restaurants, attendance, salaryPayments } from '../db/schema'
import { eq, and, inArray, count } from 'drizzle-orm'
import { verifyJWT } from '../lib/jwt'
import { PLAN_LIMITS } from './restaurants'

async function requireAuth(headers: any, roles: string[], set: any) {
  const auth = headers['authorization']
  if (!auth?.startsWith('Bearer ')) { set.status = 401; return null }
  try {
    const payload = await verifyJWT(auth.slice(7))
    if (!roles.includes(payload.role)) { set.status = 403; return null }
    return payload
  } catch { set.status = 401; return null }
}

export const employeeRoutes = new Elysia({ prefix: '/employees' })

  // GET /employees
  .get('/', async ({ headers, set }) => {
    const payload = await requireAuth(headers, ['manager'], set)
    if (!payload) return
    return db.select({ id: users.id, name: users.name, email: users.email, role: users.role, salary: users.salary, is_active: users.is_active, created_at: users.created_at })
      .from(users).where(and(eq(users.restaurant_id, payload.restaurantId!), inArray(users.role, ['manager', 'employee', 'chef'])))
  })

  // POST /employees
  .post('/', async ({ headers, body, set }) => {
    const payload = await requireAuth(headers, ['manager'], set)
    if (!payload) return
    const [rest] = await db.select({ plan: restaurants.plan }).from(restaurants).where(eq(restaurants.id, payload.restaurantId!)).limit(1)
    const limit = PLAN_LIMITS[rest?.plan ?? 'free'].employees
    const [{ count: empCount }] = await db.select({ count: count() }).from(users)
      .where(and(eq(users.restaurant_id, payload.restaurantId!), inArray(users.role, ['manager', 'employee', 'chef']), eq(users.is_active, true)))
    if (empCount >= limit) {
      set.status = 402
      return { error: `Plan limit reached`, plan: rest?.plan, limit, current: empCount }
    }
    const hashedPw = await bcrypt.hash(body.password, 10)
    const [emp] = await db.insert(users).values({
      restaurant_id: payload.restaurantId!,
      name: body.name, email: body.email.toLowerCase().trim(),
      email_verified: true,
      password: hashedPw, role: body.role,
      salary: body.salary ?? 0,
    }).returning({ id: users.id, name: users.name, email: users.email, role: users.role })
    return emp
  }, {
    body: t.Object({
      name: t.String(), email: t.String(), password: t.String(),
      role: t.Union([t.Literal('manager'), t.Literal('employee'), t.Literal('chef')]),
      salary: t.Optional(t.Number()),
    }),
  })

  // PUT /employees/:id
  .put('/:id', async ({ headers, params, body, set }) => {
    const payload = await requireAuth(headers, ['manager'], set)
    if (!payload) return
    const updates: Record<string, any> = { name: body.name }
    if (body.email) updates.email = body.email.toLowerCase().trim()
    if (body.password) updates.password = await bcrypt.hash(body.password, 10)
    await db.update(users).set(updates).where(and(eq(users.id, params.id), eq(users.restaurant_id, payload.restaurantId!)))
    return { success: true }
  }, { body: t.Object({ name: t.Optional(t.String()), email: t.Optional(t.String()), password: t.Optional(t.String()) }) })

  // PATCH /employees/:id/toggle
  .patch('/:id/toggle', async ({ headers, params, set }) => {
    const payload = await requireAuth(headers, ['manager'], set)
    if (!payload) return
    const [current] = await db.select({ is_active: users.is_active }).from(users).where(eq(users.id, params.id)).limit(1)
    if (!current) { set.status = 404; return { error: 'Not found' } }
    await db.update(users).set({ is_active: !current.is_active }).where(eq(users.id, params.id))
    return { success: true }
  })

  // PATCH /employees/:id/salary
  .patch('/:id/salary', async ({ headers, params, body, set }) => {
    const payload = await requireAuth(headers, ['manager'], set)
    if (!payload) return
    await db.update(users).set({ salary: body.salary }).where(and(eq(users.id, params.id), eq(users.restaurant_id, payload.restaurantId!)))
    return { success: true }
  }, { body: t.Object({ salary: t.Number() }) })

  // DELETE /employees/:id
  .delete('/:id', async ({ headers, params, set }) => {
    const payload = await requireAuth(headers, ['manager'], set)
    if (!payload) return
    await db.delete(users).where(and(eq(users.id, params.id), eq(users.restaurant_id, payload.restaurantId!)))
    return { success: true }
  })

  // POST /employees/:id/pay
  .post('/:id/pay', async ({ headers, params, body, set }) => {
    const payload = await requireAuth(headers, ['manager'], set)
    if (!payload) return
    const [payment] = await db.insert(salaryPayments).values({
      user_id: params.id, restaurant_id: payload.restaurantId!,
      amount: body.amount, month: body.month, paid_by: payload.userId,
    }).returning()
    return payment
  }, { body: t.Object({ amount: t.Number(), month: t.String() }) })

  // POST /employees/check-in
  .post('/check-in', async ({ headers, set }) => {
    const payload = await requireAuth(headers, ['employee', 'chef'], set)
    if (!payload) return
    const today = new Date().toISOString().slice(0, 10)
    const [record] = await db.insert(attendance).values({
      user_id: payload.userId, restaurant_id: payload.restaurantId!,
      date: today, check_in: new Date(),
    }).returning()
    return record
  })

  // PATCH /employees/check-out
  .patch('/check-out', async ({ headers, set }) => {
    const payload = await requireAuth(headers, ['employee', 'chef'], set)
    if (!payload) return
    const today = new Date().toISOString().slice(0, 10)
    const [record] = await db.select().from(attendance)
      .where(and(eq(attendance.user_id, payload.userId), eq(attendance.date, today)))
      .limit(1)
    if (!record) { set.status = 400; return { error: 'No check-in found' } }
    const hours = (Date.now() - record.check_in.getTime()) / 3_600_000
    const [updated] = await db.update(attendance).set({ check_out: new Date(), hours_worked: Math.round(hours * 100) / 100 })
      .where(eq(attendance.id, record.id)).returning()
    return updated
  })

  // GET /employees/attendance
  .get('/attendance', async ({ headers, query, set }) => {
    const payload = await requireAuth(headers, ['manager'], set)
    if (!payload) return
    return db.select().from(attendance).where(eq(attendance.restaurant_id, payload.restaurantId!))
  })
