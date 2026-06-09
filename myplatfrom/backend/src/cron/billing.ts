import { db } from '../db'
import { restaurants } from '../db/schema'
import { and, lt, ne, eq } from 'drizzle-orm'
import { logAudit } from '../lib/audit'

const INTERVAL_MS = 60 * 60 * 1000 // every hour

async function runBillingCron() {
  const now = new Date()

  const expired = await db
    .select({ id: restaurants.id, name: restaurants.name, plan: restaurants.plan, plan_expires_at: restaurants.plan_expires_at })
    .from(restaurants)
    .where(and(
      ne(restaurants.plan, 'free'),
      lt(restaurants.plan_expires_at, now),
    ))

  if (expired.length === 0) return

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

    console.log(`[billing-cron] Downgraded ${rest.name} (${rest.plan} → free, expired: ${rest.plan_expires_at?.toISOString()})`)
  }

  console.log(`[billing-cron] Processed ${expired.length} expired plan(s)`)
}

export function startBillingCron() {
  runBillingCron().catch(err => console.error('[billing-cron] Error on startup:', err))
  setInterval(() => {
    runBillingCron().catch(err => console.error('[billing-cron] Error:', err))
  }, INTERVAL_MS)
  console.log('[billing-cron] Started — checking every hour')
}
