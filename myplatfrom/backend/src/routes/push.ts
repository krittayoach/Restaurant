import { Elysia, t } from 'elysia'
import { db } from '../db'
import { tables } from '../db/schema'
import { eq } from 'drizzle-orm'
import { keys } from '../lib/redis'
import { checkRateLimit, getIP } from '../lib/rateLimit'
import { getVapidPublicKey, saveSubscription, pushEnabled } from '../lib/push'

export const pushRoutes = new Elysia({ prefix: '/push' })

  // GET /push/vapid-public-key  (public) — frontend ใช้สร้าง PushSubscription
  .get('/vapid-public-key', () => ({ key: getVapidPublicKey(), enabled: pushEnabled }))

  // POST /push/subscribe  (customer — no auth, qrToken เป็น secret)
  .post('/subscribe', async ({ body, set, request }) => {
    if (!pushEnabled) { set.status = 503; return { error: 'Push not configured' } }
    const limited = await checkRateLimit(keys.pushRateLimit(getIP(request)), 20, 600)
    if (limited) { set.status = 429; set.headers['Retry-After'] = '600'; return { error: 'Too many requests. Please try again later.' } }

    const [table] = await db.select({ id: tables.id, restaurant_id: tables.restaurant_id })
      .from(tables).where(eq(tables.qr_token, body.qrToken)).limit(1)
    if (!table) { set.status = 404; return { error: 'Invalid QR code' } }

    await saveSubscription(table.restaurant_id, table.id, body.subscription)
    return { ok: true }
  }, {
    body: t.Object({
      qrToken: t.String(),
      subscription: t.Object({
        endpoint: t.String(),
        keys: t.Object({ p256dh: t.String(), auth: t.String() }),
      }),
    }),
  })
