import { Elysia, t } from 'elysia'
import { db } from '../db'
import { auditLogs } from '../db/schema'
import { eq, desc, and } from 'drizzle-orm'
import { verifyJWT } from '../lib/jwt'
import { redis, keys } from '../lib/redis'

async function requireAuth(headers: any, roles: string[], set: any) {
  const auth = headers['authorization']
  if (!auth?.startsWith('Bearer ')) { set.status = 401; return null }
  try {
    const payload = await verifyJWT(auth.slice(7))
    if (!roles.includes(payload.role)) { set.status = 403; return null }
    if (payload.role === 'super_admin') {
      const session = await redis.get(keys.session(auth.slice(7)))
      if (!session) { set.status = 401; return null }
    }
    return payload
  } catch { set.status = 401; return null }
}

export const auditLogRoutes = new Elysia({ prefix: '/audit-logs' })

  // GET /audit-logs  — super_admin: all; manager: own restaurant only
  .get('/', async ({ headers, query, set }) => {
    const payload = await requireAuth(headers, ['super_admin', 'manager'], set)
    if (!payload) return

    const page  = Math.max(1, Number(query.page)  || 1)
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 50))
    const offset = (page - 1) * limit

    const conditions = []

    // manager sees only their restaurant's logs
    if (payload.role === 'manager') {
      if (!payload.restaurantId) { set.status = 403; return { error: 'Forbidden' } }
      conditions.push(eq(auditLogs.restaurant_id, payload.restaurantId))
    }

    if (query.action) {
      conditions.push(eq(auditLogs.action, query.action as string))
    }

    const rows = await db.select().from(auditLogs)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(auditLogs.created_at))
      .limit(limit)
      .offset(offset)

    return { logs: rows, page, limit }
  }, {
    query: t.Object({
      page:   t.Optional(t.String()),
      limit:  t.Optional(t.String()),
      action: t.Optional(t.String()),
    }),
  })
