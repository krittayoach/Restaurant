import { Elysia, t } from 'elysia'
import { db } from '../db'
import { planPayments, restaurants, users } from '../db/schema'
import { eq, desc } from 'drizzle-orm'
import { PLAN_LIMITS } from './restaurants'
import { verifyJWT } from '../lib/jwt'
import { uploadFile, getPublicUrl } from '../lib/storage'

const PLATFORM_PROMPTPAY = process.env.PLATFORM_PROMPTPAY_ID ?? '0812345678'

async function requireAuth(headers: any, roles: string[], set: any) {
  const auth = headers['authorization']
  if (!auth?.startsWith('Bearer ')) { set.status = 401; return null }
  try {
    const payload = await verifyJWT(auth.slice(7))
    if (!roles.includes(payload.role)) { set.status = 403; return null }
    return payload
  } catch { set.status = 401; return null }
}

export const billingRoutes = new Elysia({ prefix: '/billing' })

  // GET /billing/plans — public plan info + platform promptpay
  .get('/plans', () => ({ plans: PLAN_LIMITS, promptpay: PLATFORM_PROMPTPAY }))

  // POST /billing/slip — upload slip image, return URL
  .post('/slip', async ({ headers, body, set }) => {
    const payload = await requireAuth(headers, ['manager'], set)
    if (!payload) return
    const file = body.slip as File
    const key = `plan-slips/${payload.restaurantId}/${Date.now()}_${file.name}`
    await uploadFile(key, await file.arrayBuffer(), file.type)
    return { url: getPublicUrl(key) }
  }, {
    body: t.Object({ slip: t.File({ maxSize: 5 * 1024 * 1024 }) }),
  })

  // POST /billing/upgrade — create payment record
  .post('/upgrade', async ({ headers, body, set }) => {
    const payload = await requireAuth(headers, ['manager'], set)
    if (!payload) return
    const [rest] = await db.select({ plan: restaurants.plan }).from(restaurants)
      .where(eq(restaurants.id, payload.restaurantId!)).limit(1)
    if (!rest) { set.status = 404; return { error: 'Restaurant not found' } }
    if (rest.plan === body.plan) { set.status = 400; return { error: 'Already on this plan' } }
    const amount = PLAN_LIMITS[body.plan]?.price ?? 0
    const isCard = body.method === 'card'
    const status = isCard ? 'approved' : 'pending'
    const [payment] = await db.insert(planPayments).values({
      restaurant_id: payload.restaurantId!,
      plan: body.plan as any,
      amount,
      method: body.method,
      status: status as any,
      slip_url: body.slip_url ?? null,
    }).returning()
    if (isCard) {
      await db.update(restaurants).set({ plan: body.plan as any }).where(eq(restaurants.id, payload.restaurantId!))
    }
    return { payment, upgraded: isCard }
  }, {
    body: t.Object({
      plan:     t.Union([t.Literal('basic'), t.Literal('pro')]),
      method:   t.Union([t.Literal('promptpay'), t.Literal('card')]),
      slip_url: t.Optional(t.String()),
    }),
  })

  // GET /billing/my-payments — manager: own payment history
  .get('/my-payments', async ({ headers, set }) => {
    const payload = await requireAuth(headers, ['manager'], set)
    if (!payload) return
    return db.select().from(planPayments)
      .where(eq(planPayments.restaurant_id, payload.restaurantId!))
      .orderBy(desc(planPayments.created_at))
  })

  // GET /billing/pending-payments — super_admin: pending list
  .get('/pending-payments', async ({ headers, set }) => {
    const payload = await requireAuth(headers, ['super_admin'], set)
    if (!payload) return
    return db.select({
      id:              planPayments.id,
      restaurant_id:   planPayments.restaurant_id,
      plan:            planPayments.plan,
      amount:          planPayments.amount,
      method:          planPayments.method,
      status:          planPayments.status,
      slip_url:        planPayments.slip_url,
      created_at:      planPayments.created_at,
      restaurant_name: restaurants.name,
      restaurant_slug: restaurants.slug,
      current_plan:    restaurants.plan,
    }).from(planPayments)
      .leftJoin(restaurants, eq(planPayments.restaurant_id, restaurants.id))
      .where(eq(planPayments.status, 'pending'))
      .orderBy(desc(planPayments.created_at))
  })

  // PATCH /billing/payments/:id/approve — super_admin
  .patch('/payments/:id/approve', async ({ headers, params, set }) => {
    const payload = await requireAuth(headers, ['super_admin'], set)
    if (!payload) return
    const [pmt] = await db.select().from(planPayments).where(eq(planPayments.id, params.id)).limit(1)
    if (!pmt) { set.status = 404; return { error: 'Not found' } }
    if (pmt.status !== 'pending') { set.status = 400; return { error: 'Not pending' } }
    await db.update(planPayments).set({ status: 'approved', reviewed_by: payload.userId, updated_at: new Date() }).where(eq(planPayments.id, params.id))
    await db.update(restaurants).set({ plan: pmt.plan }).where(eq(restaurants.id, pmt.restaurant_id))
    return { success: true, plan: pmt.plan }
  })

  // PATCH /billing/payments/:id/reject — super_admin
  .patch('/payments/:id/reject', async ({ headers, params, body, set }) => {
    const payload = await requireAuth(headers, ['super_admin'], set)
    if (!payload) return
    const [pmt] = await db.select().from(planPayments).where(eq(planPayments.id, params.id)).limit(1)
    if (!pmt) { set.status = 404; return { error: 'Not found' } }
    if (pmt.status !== 'pending') { set.status = 400; return { error: 'Not pending' } }
    await db.update(planPayments)
      .set({ status: 'rejected', note: body.note ?? null, reviewed_by: payload.userId, updated_at: new Date() })
      .where(eq(planPayments.id, params.id))
    return { success: true }
  }, {
    body: t.Object({ note: t.Optional(t.String()) }),
  })
