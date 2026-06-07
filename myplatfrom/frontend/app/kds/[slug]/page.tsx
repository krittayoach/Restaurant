'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { api, getToken } from '@/lib/api'
import { useSSE } from '@/hooks/useSSE'

interface OrderItem {
  id: string
  menu_name: string
  quantity: number
  note?: string
  status: string
}
interface Order {
  id: string
  table_id: string
  created_at: string
  status: string
  items: OrderItem[]
}

const elapsed = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 60000)

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

export default function KDSPage() {
  const { slug } = useParams() as { slug: string }
  const [orders, setOrders]   = useState<Order[]>([])
  const [tableMap, setTableMap] = useState<Record<string, string>>({})
  const [stats, setStats]     = useState({ pending: 0, cooking: 0, ready: 0 })
  const [token, setToken]     = useState('')
  const [loading, setLoading] = useState(true)
  const [restaurantName, setRestaurantName] = useState('')

  const loadAll = useCallback(async (t: string) => {
    const [q, s, tbls, rest] = await Promise.all([
      api.get('/kitchen/queue', t).catch(() => []),
      api.get('/kitchen/stats', t).catch(() => ({ pending: 0, cooking: 0, ready: 0 })),
      api.get('/tables', t).catch(() => []),
      api.get(`/restaurants/${slug}`).catch(() => null),
    ])
    setOrders(q ?? [])
    setStats(s ?? { pending: 0, cooking: 0, ready: 0 })
    const map: Record<string, string> = {}
    for (const tbl of (tbls ?? [])) map[tbl.id] = tbl.label
    setTableMap(map)
    if (rest?.name) setRestaurantName(rest.name)
    setLoading(false)
  }, [slug])

  useEffect(() => {
    const t = getToken()
    setToken(t)
    loadAll(t)
  }, [loadAll])

  useSSE('/kitchen/stream', (e) => {
    const msg = JSON.parse(e.data)
    if (['NEW_ORDER', 'ITEM_STATUS', 'ORDER_ACCEPTED'].includes(msg.type)) loadAll(getToken())
  })

  async function updateItem(id: string, status: string) {
    await api.patch(`/kitchen/items/${id}/status`, { status }, token).catch(() => null)
    loadAll(token)
  }

  async function acceptAll(orderId: string) {
    await api.patch(`/kitchen/orders/${orderId}/accept-all`, {}, token).catch(() => null)
    loadAll(token)
  }

  if (loading) return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <p className="text-muted text-lg animate-pulse">กำลังโหลด...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Top bar */}
      <div className="bg-bg2 border-b border-border px-6 py-3 flex items-center gap-6 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-2xl">👨‍🍳</span>
          <div>
            <p className="font-display font-bold text-base text-text leading-none">Kitchen Display</p>
            {restaurantName && <p className="text-xs text-muted">{restaurantName}</p>}
          </div>
        </div>

        <div className="flex items-center gap-1.5 ml-2">
          <span className="w-2.5 h-2.5 rounded-full bg-green pulse-ring" />
          <span className="text-xs text-green font-medium">realtime</span>
        </div>

        <div className="flex gap-4 ml-auto items-center">
          {[
            { emoji: '⏳', label: 'รอทำ',        count: stats.pending, cls: 'text-yellow' },
            { emoji: '🔥', label: 'กำลังทำ',     count: stats.cooking, cls: 'text-accent' },
            { emoji: '✅', label: 'พร้อมเสิร์ฟ', count: stats.ready,   cls: 'text-green'  },
          ].map(s => (
            <div key={s.label} className="text-center">
              <p className={`font-display font-bold text-2xl leading-none ${s.cls}`}>{s.count}</p>
              <p className="text-[10px] text-muted">{s.label}</p>
            </div>
          ))}
          <div className="border-l border-border pl-4 ml-2">
            <Clock />
          </div>
        </div>
      </div>

      {/* Orders grid */}
      <div className="flex-1 p-4 overflow-y-auto">
        {orders.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-4">
            <div className="text-8xl floaty">🎉</div>
            <p className="text-muted text-xl">ไม่มีออเดอร์ค้าง พักได้เลย!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {orders.map((order) => {
              const mins   = elapsed(order.created_at)
              const urgent = mins > 15
              const items  = order.items.filter(it => it.status !== 'cancelled' && it.status !== 'served')
              const tableLabel = tableMap[order.table_id] ?? '—'

              return (
                <div key={order.id}
                  className={`rounded-2xl border-2 overflow-hidden flex flex-col ${urgent ? 'border-rose/60 bg-rose/5' : 'border-border bg-bg2'}`}>

                  {/* Card header */}
                  <div className={`px-4 py-3 flex items-center justify-between ${urgent ? 'bg-rose/10' : 'bg-bg3'}`}>
                    <div>
                      <p className="font-display font-bold text-3xl text-text leading-none">{tableLabel}</p>
                      <p className={`text-sm font-semibold mt-0.5 ${urgent ? 'text-rose' : 'text-muted'}`}>
                        {mins} นาที {urgent ? '🔥' : ''}
                      </p>
                    </div>
                    <button onClick={() => acceptAll(order.id)}
                      className="text-sm bg-teal text-white px-4 py-2 rounded-xl font-semibold hover:brightness-110 active:scale-95 transition-all">
                      รับทั้งหมด
                    </button>
                  </div>

                  {/* Items */}
                  <div className="p-3 space-y-2 flex-1">
                    {items.map(item => (
                      <div key={item.id}
                        className={`rounded-xl p-3 border ${
                          item.status === 'ready'   ? 'bg-green/10 border-green/20' :
                          item.status === 'cooking' ? 'bg-accent/10 border-accent/20' :
                                                      'bg-bg3 border-border'
                        }`}>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-base text-text leading-tight">
                              {item.menu_name}
                              <span className="text-muted font-normal ml-1">×{item.quantity}</span>
                            </p>
                            {item.note && <p className="text-sm text-yellow mt-0.5">📝 {item.note}</p>}
                          </div>
                          <span className={`text-xs font-semibold px-2 py-1 rounded-lg shrink-0 ${
                            item.status === 'ready'   ? 'bg-green/20 text-green' :
                            item.status === 'cooking' ? 'bg-accent/20 text-accent' :
                                                        'bg-yellow/20 text-yellow'
                          }`}>
                            {item.status === 'ready' ? 'พร้อม' : item.status === 'cooking' ? 'กำลังทำ' : 'รอทำ'}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          {item.status === 'pending' && (
                            <button onClick={() => updateItem(item.id, 'cooking')}
                              className="flex-1 py-2 rounded-lg bg-accent text-white text-sm font-bold active:scale-95 transition-transform">
                              รับทำ
                            </button>
                          )}
                          {item.status === 'cooking' && (
                            <button onClick={() => updateItem(item.id, 'ready')}
                              className="flex-1 py-2 rounded-lg bg-green text-white text-sm font-bold active:scale-95 transition-transform">
                              เสร็จแล้ว ✓
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
