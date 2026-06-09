import { db } from '../db'
import { restaurants } from '../db/schema'
import { and, lt, lte, gte, ne, eq, isNotNull } from 'drizzle-orm'
import { logAudit } from '../lib/audit'
import { sendEmail, tplPlanDowngraded, tplPlanExpiringSoon } from '../lib/email'
import { redis } from '../lib/redis'

const INTERVAL_MS    = 60 * 60 * 1000  // every hour
const REMINDER_DAYS  = 7

function reminderKey(restaurantId: string) {
  return `billing:reminder:${restaurantId}`
}

async function runBillingCron() {
  const now        = new Date()
  const in7Days    = new Date(now.getTime() + REMINDER_DAYS * 86400000)

  // ── 1. Downgrade expired plans ────────────────────────────────────────────
  const expired = await db
    .select({ id: restaurants.id, name: restaurants.name, plan: restaurants.plan, plan_expires_at: restaurants.plan_expires_at, contact_email: restaurants.contact_email })
    .from(restaurants)
    .where(and(ne(restaurants.plan, 'free'), lt(restaurants.plan_expires_at, now)))

  for (const rest of expired) {
    await db.update(restaurants)
      .set({ plan: 'free', plan_expires_at: null })
      .where(eq(restaurants.id, rest.id))

    logAudit('BILLING_DOWNGRADE', {
      restaurantId: rest.id,
      actorRole: 'system',
      entityType: 'restaurant',
      entityId: rest.id,
      meta: { previousPlan: rest.plan, restaurantName: rest.name, expiredAt: rest.plan_expires_at },
    })

    if (rest.contact_email) {
      const tpl = tplPlanDowngraded(rest.name, rest.plan)
      sendEmail({ to: rest.contact_email, ...tpl })
    }

    // Clear reminder key so next cycle works cleanly
    await redis.del(reminderKey(rest.id))

    console.log(`[billing-cron] Downgraded ${rest.name} (${rest.plan} → free)`)
  }

  // ── 2. Send 7-day expiry reminders ────────────────────────────────────────
  const expiringSoon = await db
    .select({ id: restaurants.id, name: restaurants.name, plan: restaurants.plan, plan_expires_at: restaurants.plan_expires_at, contact_email: restaurants.contact_email })
    .from(restaurants)
    .where(and(
      ne(restaurants.plan, 'free'),
      isNotNull(restaurants.plan_expires_at),
      gte(restaurants.plan_expires_at, now),
      lte(restaurants.plan_expires_at, in7Days),
    ))

  for (const rest of expiringSoon) {
    if (!rest.contact_email) continue
    const alreadySent = await redis.get(reminderKey(rest.id))
    if (alreadySent) continue

    const daysLeft = Math.ceil((rest.plan_expires_at!.getTime() - now.getTime()) / 86400000)
    const tpl = tplPlanExpiringSoon(rest.name, rest.plan, rest.plan_expires_at!, daysLeft)
    sendEmail({ to: rest.contact_email, ...tpl })

    // TTL 8 วัน — จะ reset เองหลังผ่านไป หรือ del เมื่อ downgrade
    await redis.set(reminderKey(rest.id), '1', 'EX', 8 * 86400)

    console.log(`[billing-cron] Reminder sent to ${rest.name} (expires in ${daysLeft}d)`)
  }

  if (expired.length + expiringSoon.length > 0) {
    console.log(`[billing-cron] Done — ${expired.length} downgraded, ${expiringSoon.filter(r => r.contact_email).length} reminded`)
  }
}

export function startBillingCron() {
  runBillingCron().catch(err => console.error('[billing-cron] Error on startup:', err))
  setInterval(() => {
    runBillingCron().catch(err => console.error('[billing-cron] Error:', err))
  }, INTERVAL_MS)
  console.log('[billing-cron] Started — checking every hour')
}
