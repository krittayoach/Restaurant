import webpush from 'web-push'
import { redis, keys, PUSH_SUB_TTL } from './redis'

const VAPID_PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY ?? ''
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? ''
const VAPID_SUBJECT     = process.env.VAPID_SUBJECT ?? 'mailto:noreply@restaurant-saas.com'

export const pushEnabled = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY)

if (pushEnabled) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
}

export function getVapidPublicKey() {
  return VAPID_PUBLIC_KEY
}

/** เก็บ subscription ของลูกค้า (per โต๊ะ) ใน Redis set + refresh TTL */
export async function saveSubscription(restaurantId: string, tableId: string, subscription: unknown) {
  const key = keys.pushSubs(restaurantId, tableId)
  await redis.sadd(key, JSON.stringify(subscription))
  await redis.expire(key, PUSH_SUB_TTL)
}

export interface PushPayload {
  title: string
  body: string
  url?: string
  tag?: string
}

/** ส่ง web push ให้ทุก subscription ของโต๊ะ; prune subscription ที่ตายแล้ว (404/410) */
export async function sendPushToTable(restaurantId: string, tableId: string, payload: PushPayload) {
  if (!pushEnabled) return
  const key = keys.pushSubs(restaurantId, tableId)
  const subs = await redis.smembers(key)
  if (subs.length === 0) return

  const data = JSON.stringify(payload)
  await Promise.all(subs.map(async raw => {
    try {
      await webpush.sendNotification(JSON.parse(raw), data)
    } catch (err: any) {
      // 404/410 = subscription หมดอายุ/ถูกยกเลิก → ลบทิ้ง
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        await redis.srem(key, raw)
      }
    }
  }))
}
