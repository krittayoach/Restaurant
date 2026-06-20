import { api } from './api'

/** VAPID public key (base64url) → Uint8Array สำหรับ PushManager.subscribe */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export function pushSupported(): boolean {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  if (!pushSupported()) return 'unsupported'
  return Notification.permission
}

/**
 * ขอ permission + subscribe push สำหรับโต๊ะนี้ แล้วส่ง subscription ไป backend
 * คืน true เมื่อสำเร็จ, false เมื่อ user ปฏิเสธ/ไม่รองรับ
 */
export async function enablePushForTable(qrToken: string): Promise<boolean> {
  if (!pushSupported()) return false

  const { key, enabled } = await api.get('/push/vapid-public-key').catch(() => ({ key: '', enabled: false }))
  if (!enabled || !key) return false

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return false

  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
    })
  }

  await api.post('/push/subscribe', { qrToken, subscription: sub.toJSON() })
  return true
}
