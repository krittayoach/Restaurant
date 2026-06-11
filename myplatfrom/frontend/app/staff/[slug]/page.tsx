'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { api, getToken } from '@/lib/api'
import { useSSE } from '@/hooks/useSSE'
import { WifiOff, RefreshCw, CheckCircle2, Download, Banknote, QrCode } from 'lucide-react'
import { cn } from '@/lib/cn'

interface ReadyItem {
  id: string
  menu_name: string
  quantity: number
  note?: string
}
interface ReadyOrder {
  id: string
  table: { label: string }
  created_at: string
  items: ReadyItem[]
}
interface PaymentOrder {
  id: string
  total: number
  payment_method: string | null
  table: { label: string }
  created_at: string
  items: { menu_name: string; quantity: number; unit_price: number }[]
}

function Clock() {
  const [time, setTime] = useState('')
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  return <span className="font-mono text-xl font-bold text-text">{time}</span>
}

export default function StaffDisplayPage() {
  const { slug } = useParams() as { slug: string }
  const [readyOrders, setReadyOrders]     = useState<ReadyOrder[]>([])
  const [paymentOrders, setPaymentOrders] = useState<PaymentOrder[]>([])
  const [restaurantName, setRestaurantName] = useState('')
  const [token, setToken]   = useState('')
  const [loading, setLoading] = useState(true)
  const [isOnline, setIsOnline] = useState(true)
  const [busyServe, setBusyServe]     = useState<Record<string, boolean>>({})
  const [busyPayment, setBusyPayment] = useState<Record<string, boolean>>({})
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const tokenRef = useRef('')

  const loadAll = useCallback(async (t: string) => {
    try {
      const [queue, pending, rest] = await Promise.all([
        api.get('/serving/queue', t).catch(() => null),
        api.get('/orders/pending-payment', t).catch(() => null),
        api.get(`/restaurants/${slug}`).catch(() => null),
      ])
      if (queue !== null) setReadyOrders(queue)
      if (pending !== null) {
        setPaymentOrders((pending as PaymentOrder[]).filter(o => o.payment_method !== null))
      }
      if (rest?.name) setRestaurantName(rest.name)
      setLoading(false)
    } catch {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    const t = getToken()
    setToken(t)
    tokenRef.current = t
    loadAll(t)
  }, [loadAll])

  useSSE('/serving/stream', (e) => {
    const msg = JSON.parse(e.data)
    if (['ITEM_READY', 'ITEM_SERVED', 'ORDER_SERVED', 'PAYMENT_REQUESTED', 'PAYMENT_VERIFIED'].includes(msg.type)) {
      loadAll(tokenRef.current)
    }
  })

  useEffect(() => {
    const up = () => { setIsOnline(true); loadAll(tokenRef.current) }
    const dn = () => setIsOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', dn)
    setIsOnline(navigator.onLine)
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', dn) }
  }, [loadAll])

  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setInstallPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler as any)
    window.addEventListener('appinstalled', () => setInstallPrompt(null))
    return () => window.removeEventListener('beforeinstallprompt', handler as any)
  }, [])

  async function serveItem(itemId: string) {
    setBusyServe(b => ({ ...b, [itemId]: true }))
    try {
      await api.patch(`/serving/items/${itemId}/serve`, {}, token)
      loadAll(token)
    } finally {
      setBusyServe(b => ({ ...b, [itemId]: false }))
    }
  }

  async function confirmPayment(orderId: string) {
    setBusyPayment(b => ({ ...b, [orderId]: true }))
    try {
      await api.patch('/payment/verify', { orderId }, token)
      loadAll(token)
    } finally {
      setBusyPayment(b => ({ ...b, [orderId]: false }))
    }
  }

  async function installApp() {
    if (!installPrompt) return
    await installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') setInstallPrompt(null)
  }

  if (loading) return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <p className="text-muted text-lg animate-pulse">กำลังโหลด...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {!isOnline && (
        <div className="bg-rose/90 text-white text-center text-sm py-2 font-medium flex items-center justify-center gap-2">
          <WifiOff size={14} /> ไม่มีการเชื่อมต่อ
        </div>
      )}

      {/* Top bar */}
      <div className="bg-bg2 border-b border-border px-6 py-3 flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🍽️</span>
          <div>
            <p className="font-display font-bold text-base text-text leading-none">Staff Display</p>
            {restaurantName && <p className="text-xs text-muted">{restaurantName}</p>}
          </div>
        </div>

        <div className="flex items-center gap-1.5 ml-2">
          {isOnline ? (
            <><span className="size-2.5 rounded-full bg-green pulse-ring" /><span className="text-xs text-green font-medium">realtime</span></>
          ) : (
            <><span className="size-2.5 rounded-full bg-rose" /><span className="text-xs text-rose font-medium">ออฟไลน์</span></>
          )}
        </div>

        <div className="flex gap-4 ml-auto items-center">
          <div className="text-center">
            <p className="font-display font-bold text-2xl text-green leading-none">{readyOrders.reduce((s, o) => s + o.items.length, 0)}</p>
            <p className="text-[10px] text-muted">รอเสิร์ฟ</p>
          </div>
          <div className="text-center">
            <p className="font-display font-bold text-2xl text-accent leading-none">{paymentOrders.length}</p>
            <p className="text-[10px] text-muted">รอรับเงิน</p>
          </div>
          <div className="border-l border-border pl-4">
            <Clock />
          </div>
          {installPrompt && (
            <button onClick={installApp}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-accent/10 text-accent text-xs font-semibold hover:bg-accent/20 transition-all border border-accent/20">
              <Download size={14} /> ติดตั้งแอป
            </button>
          )}
        </div>
      </div>

      {/* Body — 2 columns */}
      <div className="flex-1 p-4 grid grid-cols-1 lg:grid-cols-2 gap-4 overflow-y-auto">

        {/* Left: ready to serve */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="size-2.5 rounded-full bg-green" />
            <h2 className="font-bold text-sm text-text uppercase tracking-wide">รอเสิร์ฟ</h2>
            <span className="text-xs text-muted ml-1">({readyOrders.reduce((s, o) => s + o.items.length, 0)} รายการ)</span>
          </div>
          {readyOrders.length === 0 ? (
            <div className="rounded-2xl border border-border bg-bg2 p-12 text-center">
              <p className="text-4xl mb-2">✅</p>
              <p className="text-muted text-sm">ทุกรายการเสิร์ฟแล้ว</p>
            </div>
          ) : (
            <div className="space-y-3">
              {readyOrders.map(order => (
                <div key={order.id} className="rounded-2xl border-2 border-green/30 bg-bg2 overflow-hidden">
                  <div className="bg-green/10 px-4 py-3 flex items-center justify-between">
                    <p className="font-display font-bold text-2xl text-text">{order.table.label}</p>
                    <button
                      onClick={() => order.items.forEach(i => serveItem(i.id))}
                      disabled={order.items.some(i => busyServe[i.id])}
                      className="text-sm bg-green text-white px-4 py-2 rounded-xl font-semibold hover:brightness-110 active:scale-95 transition-all disabled:opacity-60">
                      เสิร์ฟทั้งหมด
                    </button>
                  </div>
                  <div className="p-3 space-y-2">
                    {order.items.map(item => (
                      <div key={item.id} className="flex items-center gap-3 rounded-xl bg-green/5 border border-green/20 p-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-text">
                            {item.menu_name}
                            <span className="text-muted font-normal ml-1">×{item.quantity}</span>
                          </p>
                          {item.note && <p className="text-xs text-yellow mt-0.5">📝 {item.note}</p>}
                        </div>
                        <button
                          onClick={() => serveItem(item.id)}
                          disabled={busyServe[item.id]}
                          className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green text-white text-xs font-bold active:scale-95 transition-transform disabled:opacity-60">
                          {busyServe[item.id]
                            ? <div className="size-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            : <CheckCircle2 size={13} />}
                          เสิร์ฟแล้ว
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Right: payment pending */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="size-2.5 rounded-full bg-accent" />
            <h2 className="font-bold text-sm text-text uppercase tracking-wide">รอรับเงิน</h2>
            <span className="text-xs text-muted ml-1">({paymentOrders.length} รายการ)</span>
          </div>
          {paymentOrders.length === 0 ? (
            <div className="rounded-2xl border border-border bg-bg2 p-12 text-center">
              <p className="text-4xl mb-2">💰</p>
              <p className="text-muted text-sm">ไม่มีรายการรอชำระเงิน</p>
            </div>
          ) : (
            <div className="space-y-3">
              {paymentOrders.map(order => (
                <div key={order.id} className={cn('rounded-2xl border-2 overflow-hidden bg-bg2',
                  order.payment_method === 'cash' ? 'border-yellow/40' : 'border-blue/30')}>
                  <div className={cn('px-4 py-3 flex items-center justify-between',
                    order.payment_method === 'cash' ? 'bg-yellow/10' : 'bg-blue/10')}>
                    <div className="flex items-center gap-3">
                      <p className="font-display font-bold text-2xl text-text">{order.table.label}</p>
                      <div className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold',
                        order.payment_method === 'cash' ? 'bg-yellow/20 text-yellow' : 'bg-blue/20 text-blue')}>
                        {order.payment_method === 'cash' ? <Banknote size={12} /> : <QrCode size={12} />}
                        {order.payment_method === 'cash' ? 'เงินสด' : 'QR โอน'}
                      </div>
                    </div>
                    <p className="font-display font-bold text-xl text-accent">฿{order.total.toFixed(0)}</p>
                  </div>
                  <div className="px-4 py-2 space-y-0.5">
                    {order.items.map((item, i) => (
                      <p key={i} className="text-xs text-muted">
                        {item.menu_name} ×{item.quantity}
                        <span className="ml-1 text-text font-medium">฿{(item.unit_price * item.quantity).toFixed(0)}</span>
                      </p>
                    ))}
                  </div>
                  <div className="px-4 pb-3">
                    <button
                      onClick={() => confirmPayment(order.id)}
                      disabled={busyPayment[order.id]}
                      className="w-full py-2.5 rounded-xl bg-accent text-white font-bold text-sm active:scale-[.98] transition-transform hover:brightness-110 disabled:opacity-60 flex items-center justify-center gap-2">
                      {busyPayment[order.id]
                        ? <div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        : <CheckCircle2 size={15} />}
                      รับเงินแล้ว · ยืนยัน
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  )
}
