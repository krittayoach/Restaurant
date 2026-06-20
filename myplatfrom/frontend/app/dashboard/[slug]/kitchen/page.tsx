'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { api, getToken } from '@/lib/api'
import { Clock } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useSSE } from '@/hooks/useSSE'
import { LoadingScreen } from '@/components/LoadingScreen'
import { useToast } from '@/components/Toast'
import { Spinner } from '@/components/Spinner'
import { useDashboardLang } from '@/lib/i18n-dashboard'

interface OrderItem { id: string; menu_name: string; quantity: number; note?: string; status: string }
interface Order { id: string; created_at: string; status: string; items: OrderItem[] }
const elapsed = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 60000)

export default function KitchenPage() {
  const params = useParams() as { slug: string }
  const { t } = useDashboardLang()
  const [orders, setOrders] = useState<Order[]>([])
  const [stats, setStats] = useState({ pending: 0, cooking: 0, ready: 0 })
  const toast = useToast()
  const [token, setToken] = useState('')
  const [busyId, setBusyId] = useState<Record<string, boolean>>({})
  const [pageLoading, setPageLoading] = useState(true)

  useEffect(() => {
    const t = getToken()
    setToken(t); loadAll(t)
  }, [])

  useSSE('/kitchen/stream', (e) => {
    const msg = JSON.parse(e.data)
    if (['NEW_ORDER', 'ITEM_STATUS', 'ORDER_ACCEPTED'].includes(msg.type)) loadAll(getToken())
  })

  async function loadAll(t: string) {
    const [q, s] = await Promise.all([
      api.get('/kitchen/queue', t).catch(() => []),
      api.get('/kitchen/stats', t).catch(() => ({ pending: 0, cooking: 0, ready: 0 })),
    ])
    setOrders(q); setStats(s); setPageLoading(false)
  }
  async function acceptAll(id: string) {
    setBusyId(b => ({ ...b, [`order_${id}`]: true }))
    try { await api.patch(`/kitchen/orders/${id}/accept-all`, {}, token); loadAll(token) }
    catch (e: any) { toast.error(e.message ?? 'เกิดข้อผิดพลาด') }
    finally { setBusyId(b => ({ ...b, [`order_${id}`]: false })) }
  }
  async function updateItem(id: string, status: string) {
    setBusyId(b => ({ ...b, [id]: true }))
    try { await api.patch(`/kitchen/items/${id}/status`, { status }, token); loadAll(token) }
    catch (e: any) { toast.error(e.message ?? 'เกิดข้อผิดพลาด') }
    finally { setBusyId(b => ({ ...b, [id]: false })) }
  }

  const ITEM_STATUS: Record<string, { label: string; cls: string }> = {
    pending: { label: t.kitchen.pending, cls: 'bg-yellow/10 text-yellow' },
    cooking: { label: t.kitchen.cooking, cls: 'bg-accent/10 text-accent' },
    ready:   { label: t.kitchen.ready,   cls: 'bg-green/10  text-green' },
  }

  const cards = [
    { label: t.kitchen.pending, count: stats.pending, emoji: '⏳', bg: 'bg-yellow/10', text: 'text-yellow' },
    { label: t.kitchen.cooking, count: stats.cooking, emoji: '🔥', bg: 'bg-accent/10', text: 'text-accent' },
    { label: t.kitchen.ready,   count: stats.ready,   emoji: '✅', bg: 'bg-green/10',  text: 'text-green' },
  ]

  if (pageLoading) return <LoadingScreen />

  return (
    <div className="p-5 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 anim-up">
        <div>
          <h1 className="font-display font-bold text-2xl md:text-3xl text-text text-balance">👨‍🍳 Kitchen Board</h1>
          <p className="text-xs text-muted font-mono mt-0.5 flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-green pulse-ring inline-block" /> {t.kitchen.subtitle}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {cards.map(s => (
            <div key={s.label} className={cn('rounded-2xl px-4 py-2.5 border border-border text-center', s.bg, s.text)}>
              <div className="text-base">{s.emoji}</div>
              <div className="font-display font-bold text-xl leading-none">{s.count}</div>
              <div className="text-[10px] text-muted mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {orders.map((order, i) => {
          const mins = elapsed(order.created_at)
          const urgent = mins > 15
          const items = order.items.filter(it => it.status !== 'cancelled' && it.status !== 'served')
          return (
            <div key={order.id} className={`card overflow-hidden anim-up ${urgent ? 'ring-2 ring-rose/40' : ''}`} style={{ animationDelay: `${i * 50}ms` }}>
              <div className={`px-4 py-3 flex items-center justify-between ${urgent ? 'bg-rose/5' : 'bg-bg3'}`}>
                <div className="flex items-center gap-1.5">
                  <Clock size={13} className={urgent ? 'text-rose' : 'text-muted'} />
                  <span className={`text-xs font-mono font-semibold ${urgent ? 'text-rose' : 'text-muted'}`}>{mins} นาที{urgent ? ' 🔥' : ''}</span>
                </div>
                <button onClick={() => acceptAll(order.id)} disabled={busyId[`order_${order.id}`]}
                  className="text-xs bg-teal text-white px-3 py-1.5 rounded-xl font-semibold hover:brightness-110 active:scale-95 transition-all disabled:opacity-60 flex items-center gap-1.5">
                  {busyId[`order_${order.id}`] ? <Spinner size={12} /> : null}{t.kitchen.acceptAll}
                </button>
              </div>
              <div className="p-3 space-y-2">
                {items.map(item => {
                  const s = ITEM_STATUS[item.status] ?? ITEM_STATUS.pending
                  return (
                    <div key={item.id} className="bg-bg3 rounded-2xl p-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">{item.menu_name} <span className="text-muted font-normal">×{item.quantity}</span></p>
                        {item.note && <p className="text-xs text-yellow mt-0.5">📝 {item.note}</p>}
                      </div>
                      <span className={`badge ${s.cls} shrink-0`}>{s.label}</span>
                      {item.status === 'pending' && (
                        <button onClick={() => updateItem(item.id, 'cooking')} disabled={busyId[item.id]}
                          className="text-xs bg-accent text-white px-3 py-1.5 rounded-xl font-semibold active:scale-95 transition-transform shrink-0 disabled:opacity-60 flex items-center gap-1.5">
                          {busyId[item.id] ? <Spinner size={12} /> : null}{t.kitchen.startCooking}
                        </button>
                      )}
                      {item.status === 'cooking' && (
                        <button onClick={() => updateItem(item.id, 'ready')} disabled={busyId[item.id]}
                          className="text-xs bg-green text-white px-3 py-1.5 rounded-xl font-semibold active:scale-95 transition-transform shrink-0 disabled:opacity-60 flex items-center gap-1.5">
                          {busyId[item.id] ? <Spinner size={12} /> : null}{t.kitchen.done}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
        {orders.length === 0 && (
          <div className="col-span-full card p-20 text-center">
            <div className="text-6xl mb-3 floaty">🎉</div>
            <p className="text-muted text-sm">{t.kitchen.noOrders}</p>
          </div>
        )}
      </div>
    </div>
  )
}
