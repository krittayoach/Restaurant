'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { api, getToken } from '@/lib/api'
import { useSSE } from '@/hooks/useSSE'
import { WifiOff, Download, RefreshCw } from 'lucide-react'

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
interface CachedData {
  orders: Order[]
  stats: { pending: number; cooking: number; ready: number }
  tableMap: Record<string, string>
  restaurantName: string
  cachedAt: number
}

const CACHE_KEY = 'kds-data-cache'
const QUEUE_KEY = 'kds-offline-queue'

function saveCache(data: Omit<CachedData, 'cachedAt'>) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ...data, cachedAt: Date.now() })) } catch {}
}
function loadCache(): CachedData | null {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null') } catch { return null }
}

type QueueItem = { id: string; itemId: string; status: string }
function getQueue(): QueueItem[] {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') } catch { return [] }
}
function saveQueue(q: QueueItem[]) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)) } catch {}
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
  const [orders, setOrders]         = useState<Order[]>([])
  const [tableMap, setTableMap]     = useState<Record<string, string>>({})
  const [stats, setStats]           = useState({ pending: 0, cooking: 0, ready: 0 })
  const [token, setToken]           = useState('')
  const [loading, setLoading]       = useState(true)
  const [restaurantName, setRestaurantName] = useState('')

  const [isOnline, setIsOnline]     = useState(true)
  const [fromCache, setFromCache]   = useState(false)
  const [cachedAt, setCachedAt]     = useState<number | null>(null)
  const [pendingActions, setPendingActions] = useState(0)
  const [syncing, setSyncing]       = useState(false)

  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [installing, setInstalling] = useState(false)

  const tokenRef = useRef('')

  // ─── Load data ────────────────────────────────────────────────────────────
  const loadAll = useCallback(async (t: string) => {
    try {
      const [q, s, tbls, rest] = await Promise.all([
        api.get('/kitchen/queue', t).catch(() => null),
        api.get('/kitchen/stats', t).catch(() => null),
        api.get('/tables', t).catch(() => null),
        api.get(`/restaurants/${slug}`).catch(() => null),
      ])
      if (q === null && s === null) throw new Error('offline')

      const map: Record<string, string> = {}
      for (const tbl of (tbls ?? [])) map[tbl.id] = tbl.label

      const data = {
        orders: q ?? [],
        stats: s ?? { pending: 0, cooking: 0, ready: 0 },
        tableMap: map,
        restaurantName: rest?.name ?? '',
      }
      saveCache(data)
      setOrders(data.orders)
      setStats(data.stats)
      setTableMap(data.tableMap)
      if (rest?.name) setRestaurantName(rest.name)
      setFromCache(false)
      setLoading(false)
    } catch {
      const cached = loadCache()
      if (cached) {
        setOrders(cached.orders)
        setStats(cached.stats)
        setTableMap(cached.tableMap)
        if (cached.restaurantName) setRestaurantName(cached.restaurantName)
        setFromCache(true)
        setCachedAt(cached.cachedAt)
      }
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    const t = getToken()
    setToken(t)
    tokenRef.current = t
    loadAll(t)
    setPendingActions(getQueue().length)
  }, [loadAll])

  // ─── SSE ──────────────────────────────────────────────────────────────────
  useSSE('/kitchen/stream', (e) => {
    const msg = JSON.parse(e.data)
    if (['NEW_ORDER', 'ITEM_STATUS', 'ORDER_ACCEPTED'].includes(msg.type)) loadAll(tokenRef.current)
  })

  // ─── Online / Offline ─────────────────────────────────────────────────────
  useEffect(() => {
    async function handleOnline() {
      setIsOnline(true)
      await syncQueue(tokenRef.current)
      loadAll(tokenRef.current)
    }
    function handleOffline() { setIsOnline(false) }

    window.addEventListener('online',  handleOnline)
    window.addEventListener('offline', handleOffline)
    setIsOnline(navigator.onLine)
    return () => {
      window.removeEventListener('online',  handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [loadAll])

  // ─── Sync offline queue ───────────────────────────────────────────────────
  async function syncQueue(t: string) {
    const q = getQueue()
    if (q.length === 0) return
    setSyncing(true)
    const done: string[] = []
    for (const item of q) {
      try {
        await api.patch(`/kitchen/items/${item.itemId}/status`, { status: item.status }, t)
        done.push(item.id)
      } catch {}
    }
    const remaining = q.filter(i => !done.includes(i.id))
    saveQueue(remaining)
    setPendingActions(remaining.length)
    setSyncing(false)
  }

  // ─── PWA install prompt ───────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setInstallPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler as any)
    window.addEventListener('appinstalled', () => setInstallPrompt(null))
    return () => window.removeEventListener('beforeinstallprompt', handler as any)
  }, [])

  async function installApp() {
    if (!installPrompt) return
    setInstalling(true)
    await installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') setInstallPrompt(null)
    setInstalling(false)
  }

  // ─── Actions ──────────────────────────────────────────────────────────────
  async function updateItem(id: string, status: string) {
    if (!navigator.onLine) {
      const q = getQueue()
      const existing = q.findIndex(x => x.itemId === id)
      if (existing >= 0) q[existing].status = status
      else q.push({ id: Date.now().toString(), itemId: id, status })
      saveQueue(q)
      setPendingActions(q.length)
      setOrders(prev => prev.map(o => ({
        ...o,
        items: o.items.map(it => it.id === id ? { ...it, status } : it),
      })))
      return
    }
    await api.patch(`/kitchen/items/${id}/status`, { status }, token).catch(() => null)
    loadAll(token)
  }

  async function acceptAll(orderId: string) {
    await api.patch(`/kitchen/orders/${orderId}/accept-all`, {}, token).catch(() => null)
    loadAll(token)
  }

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <p className="text-muted text-lg animate-pulse">กำลังโหลด...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Offline banner */}
      {!isOnline && (
        <div className="bg-rose/90 text-white text-center text-sm py-2 font-medium flex items-center justify-center gap-2 shrink-0">
          <WifiOff size={14} />
          ไม่มีการเชื่อมต่อ — แสดงข้อมูลที่บันทึกไว้
          {pendingActions > 0 && <span className="bg-white/20 rounded-full px-2 py-0.5 text-xs">{pendingActions} รายการรอส่ง</span>}
        </div>
      )}

      {/* Pending sync banner */}
      {isOnline && pendingActions > 0 && (
        <div className="bg-yellow/90 text-black text-center text-sm py-2 font-medium flex items-center justify-center gap-2 shrink-0">
          {syncing
            ? <><div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" /> กำลังซิงค์ข้อมูลออฟไลน์...</>
            : <><RefreshCw size={14} /> กำลังส่งข้อมูลที่ค้างไว้ {pendingActions} รายการ</>}
        </div>
      )}

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
          {isOnline ? (
            <>
              <span className="w-2.5 h-2.5 rounded-full bg-green pulse-ring" />
              <span className="text-xs text-green font-medium">realtime</span>
            </>
          ) : (
            <>
              <span className="w-2.5 h-2.5 rounded-full bg-rose" />
              <span className="text-xs text-rose font-medium">ออฟไลน์</span>
            </>
          )}
        </div>

        {/* Cache timestamp */}
        {fromCache && cachedAt && (
          <div className="flex items-center gap-1 text-xs text-yellow">
            <RefreshCw size={11} />
            แคชเมื่อ {new Date(cachedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}

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

          {/* Install button */}
          {installPrompt && (
            <button
              onClick={installApp}
              disabled={installing}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-accent/10 text-accent text-xs font-semibold hover:bg-accent/20 transition-all border border-accent/20"
            >
              <Download size={14} />
              {installing ? 'กำลังติดตั้ง...' : 'ติดตั้งแอป'}
            </button>
          )}
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
