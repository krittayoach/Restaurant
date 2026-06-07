'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { api, getToken } from '@/lib/api'
import { Clock } from 'lucide-react'
import { useSSE } from '@/hooks/useSSE'
import { LoadingScreen } from '@/components/LoadingScreen'
import { useToast } from '@/components/Toast'

interface OrderItem { id: string; menu_name: string; quantity: number; note?: string; status: string }
interface Order { id: string; created_at: string; status: string; items: OrderItem[] }

const ITEM_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'รอทำ',       cls: 'bg-yellow/10 text-yellow' },
  cooking: { label: 'กำลังทำ',    cls: 'bg-accent/10 text-accent' },
  ready:   { label: 'พร้อมเสิร์ฟ', cls: 'bg-green/10  text-green' },
}
const elapsed = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 60000)

export default function KitchenPage() {
  const params = useParams() as { slug: string }
  const [orders, setOrders] = useState<Order[]>([])
  const [stats, setStats] = useState({ pending: 0, cooking: 0, ready: 0 })
  const toast = useToast()
  const [token, setToken] = useState('')
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
    try { await api.patch(`/kitchen/orders/${id}/accept-all`, {}, token); loadAll(token) }
    catch (e: any) { toast.error(e.message ?? 'เกิดข้อผิดพลาด') }
  }
  async function updateItem(id: string, status: string) {
    try { await api.patch(`/kitchen/items/${id}/status`, { status }, token); loadAll(token) }
    catch (e: any) { toast.error(e.message ?? 'เกิดข้อผิดพลาด') }
  }

  const cards = [
    { label: 'รอทำ',        count: stats.pending, emoji: '⏳', cls: 'from-yellow/15 to-yellow/5 text-yellow' },
    { label: 'กำลังทำ',     count: stats.cooking, emoji: '🔥', cls: 'from-accent/15 to-accent/5 text-accent' },
    { label: 'พร้อมเสิร์ฟ', count: stats.ready,   emoji: '✅', cls: 'from-green/15 to-green/5 text-green' },
  ]

  if (pageLoading) return <LoadingScreen />

  return (
    <div className="p-5 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 anim-up">
        <div>
          <h1 className="font-display font-bold text-2xl md:text-3xl text-text">👨‍🍳 Kitchen Board</h1>
          <p className="text-xs text-muted font-mono mt-0.5 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green pulse-ring inline-block" /> realtime
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {cards.map(s => (
            <div key={s.label} className={`rounded-2xl px-4 py-2.5 bg-gradient-to-br ${s.cls} border border-border text-center`}>
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
                <button onClick={() => acceptAll(order.id)} className="text-xs bg-teal text-white px-3 py-1.5 rounded-xl font-semibold hover:brightness-110 active:scale-95 transition-all">รับทั้งหมด</button>
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
                      {item.status === 'pending' && <button onClick={() => updateItem(item.id, 'cooking')} className="text-xs bg-accent text-white px-3 py-1.5 rounded-xl font-semibold active:scale-95 transition-transform shrink-0">รับทำ</button>}
                      {item.status === 'cooking' && <button onClick={() => updateItem(item.id, 'ready')} className="text-xs bg-green text-white px-3 py-1.5 rounded-xl font-semibold active:scale-95 transition-transform shrink-0">เสร็จ</button>}
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
            <p className="text-muted text-sm">ไม่มีออเดอร์ค้าง พักได้เลย!</p>
          </div>
        )}
      </div>
    </div>
  )
}
