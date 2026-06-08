import { db } from '../db'
import { customers, pointTransactions } from '../db/schema'
import { eq, and, sql } from 'drizzle-orm'

export const POINTS_PER_BAHT = 1 / 10   // 1 point per ฿10
export const POINTS_PER_RESERVATION = 50
export const MIN_REDEEM_POINTS = 100     // min points to redeem
export const BAHT_PER_POINT = 1         // 1 point = ฿1 discount

export async function upsertCustomer(restaurantId: string, phone: string, name: string) {
  const [existing] = await db.select()
    .from(customers)
    .where(and(eq(customers.restaurant_id, restaurantId), eq(customers.phone, phone)))
    .limit(1)

  if (existing) {
    if (existing.name !== name) {
      await db.update(customers).set({ name, updated_at: new Date() }).where(eq(customers.id, existing.id))
    }
    return existing
  }

  const [created] = await db.insert(customers)
    .values({ restaurant_id: restaurantId, phone, name })
    .returning()
  return created
}

export async function earnPoints(
  restaurantId: string, phone: string, name: string,
  points: number, source: 'order' | 'reservation' | 'manual', refId: string, note?: string,
) {
  if (points <= 0) return null
  const customer = await upsertCustomer(restaurantId, phone, name)
  await db.update(customers)
    .set({ total_points: sql`${customers.total_points} + ${points}`, updated_at: new Date() })
    .where(eq(customers.id, customer.id))
  await db.insert(pointTransactions).values({
    restaurant_id: restaurantId, customer_id: customer.id,
    type: 'earn', points, source, ref_id: refId, note: note ?? null,
  })
  return customer
}

export async function redeemPoints(
  restaurantId: string, phone: string, points: number, refId: string,
): Promise<{ success: boolean; error?: string }> {
  const [customer] = await db.select()
    .from(customers)
    .where(and(eq(customers.restaurant_id, restaurantId), eq(customers.phone, phone)))
    .limit(1)

  if (!customer) return { success: false, error: 'Customer not found' }
  if (customer.total_points < points) return { success: false, error: 'Insufficient points' }
  if (points < MIN_REDEEM_POINTS) return { success: false, error: `Minimum redeem is ${MIN_REDEEM_POINTS} points` }

  await db.update(customers)
    .set({ total_points: sql`${customers.total_points} - ${points}`, updated_at: new Date() })
    .where(eq(customers.id, customer.id))
  await db.insert(pointTransactions).values({
    restaurant_id: restaurantId, customer_id: customer.id,
    type: 'redeem', points: -points, source: 'order', ref_id: refId,
  })
  return { success: true }
}

export async function getCustomerByPhone(restaurantId: string, phone: string) {
  return db.select().from(customers)
    .where(and(eq(customers.restaurant_id, restaurantId), eq(customers.phone, phone)))
    .limit(1)
    .then(r => r[0] ?? null)
}
