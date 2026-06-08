'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { api, getToken } from '@/lib/api'
import { CheckCircle2, Banknote, BadgeCheck, X } from 'lucide-react'
import { useSSE } from '@/hooks/useSSE'
import { LoadingScreen } from '@/components/LoadingScreen'
import { useToast } from '@/components/Toast'
import { Spinner } from '@/components/Spinner'

const TABLE_STATUS: Record<string, { label: string; emoji: string; ring: string; text: string }> = {
  available: { label: 'ว่าง',          emoji: '🟢', ring: 'ring-green/30',  text: 'text-green' },
  occupied:  { label: 'มีลูกค้า',      emoji: '🍽️', ring: 'ring-accent/40', text: 'text-accent' },
  reserved:  { label: 'จอง',          emoji: '📌', ring: 'ring-violet/30', text: 'text-violet' },
  cleaning:  { label: 'ทำความสะอาด',  emoji: '🧹', ring: 'ring-yellow/30', text: 'text-yellow' },
}

const PAYMENT_STATUS: Record<string, { label: string; cls: string }> = {
  unpaid:               { label: 'รอชำระ',        cls: 'bg-bg3 text-muted' },
  pending_verification: { label: 'มีสลิป รอยืนยัน', cls: 'bg-yellow/10 text-yellow' },
}

export default function OrdersPage() {
  const params = useParams() as { slug: string }
  const [tables, setTables] = useState<any[]>([])
  const [ready, setReady] = useState<any[]>([])
  const [paymentOrders, setPaymentOrders] = useState<any[]>([])
  const toast = useToast()
  const [token, setToken] = useState('')
  const [tab, setTab] = useState<'floor' | 'ready' | 'payment'>('floor')
  const [busyId, setBusyId] = useState<Record<string, boolean>>({})
  const [pageLoading, setPageLoading] = useState(true)

  useEffect(() => {
    const t = getToken()
    setToken(t); loadData(t)
  }, [])

  useSSE('/orders/stream', () => loadData(getToken()))

  async function loadData(t: string) {
    const [tbls, rdy, pmts] = await Promise.all([
      api.get('/serving/tables', t).catch(() => []),
      api.get('/serving/ready', t).catch(() => []),
      api.get('/orders/pending-payment', t).catch(() => []),
    ])
    setTables(tbls); setReady(rdy); setPaymentOrders(pmts); setPageLoading(false)
  }

  async function serveItem(id: string) {
    setBusyId(b => ({ ...b, [id]: true }))
    try { await api.patch(`/serving/items/${id}/serve`, {}, token); loadData(token) }
    catch (e: any) { toast.error(e.message ?? 'เกิดข้อผิดพลาด') }
    finally { setBusyId(b => ({ ...b, [id]: false })) }
  }

  async function payCash(orderId: string) {
    setBusyId(b => ({ ...b, [`cash_${orderId}`]: true }))
    try { await api.patch('/payment/cash', { orderId }, token); loadData(token) }
    catch (e: any) { toast.error(e.message ?? 'เกิดข้อผิดพลาด') }
    finally { setBusyId(b => ({ ...b, [`cash_${orderId}`]: false })) }
  }

  async function verifyTransfer(orderId: string) {
    setBusyId(b => ({ ...b, [`verify_${orderId}`]: true }))
    try { await api.patch('/payment/verify', { orderId }, token); loadData(token) }
    catch (e: any) { toast.error(e.message ?? 'เกิดข้อผิดพลาด') }
    finally { setBusyId(b => ({ ...b, [`verify_${orderId}`]: false })) }
  }

  async function cancelItem(itemId: string) {
    setBusyId(b => ({ ...b, [`cancel_${itemId}`]: true }))
    try { await api.patch(`/serving/items/${itemId}/cancel`, {}, token); loadData(token) }
    catch (e: any) { toast.error(e.message ?? 'เกิดข้อผิดพลาด') }
    finally { setBusyId(b => ({ ...b, [`cancel_${itemId}`]: false })) }
  }

  const tabs = [
    { key: 'floor',   label: `🪑 ผังโต๊ะ` },
    { key: 'ready',   label: `🔔 พร้อมเสิร์ฟ${ready.length > 0 ? ` (${ready.length})` : ''}` },
    { key: 'payment', label: `💳 ชำระเงิน${paymentOrders.length > 0 ? ` (${paymentOrders.length})` : ''}` },
  ] as const

  if (pageLoading) return <LoadingScreen />

  return (
    <div className="p-5 md:p-8">
      <div className="flex items-center justify-between mb-6 anim-up">
        <div>
          <h1 className="font-display font-bold text-2xl md:text-3xl text-text">🪑 หน้าร้าน</h1>
          <p className="text-muted text-sm mt-0.5">สถานะโต๊ะแบบเรียลไทม์</p>
        </div>
      </div>

      <div className="flex gap-1.5 p-1.5 bg-bg2 border border-border rounded-2xl w-fit mb-6 shadow-sm flex-wrap">
        {tabs.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab === key ? 'bg-accent text-white shadow-md shadow-accent/30' : 'text-muted hover:text-text'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Floor tab */}
      {tab === 'floor' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {tables.map((table, i) => {
            const s = TABLE_STATUS[table.status] ?? { label: table.status, emoji: '⚪', ring: 'ring-border', text: 'text-muted' }
            return (
              <div key={table.id} className={`card card-hover p-4 ring-2 ${s.ring} anim-up`} style={{ animationDelay: `${i * 30}ms` }}>
                <div className="flex items-start justify-between mb-2">
                  <span className="font-display font-bold text-2xl">{table.label}</span>
                  <span className="text-lg">{s.emoji}</span>
                </div>
                <p className={`text-xs font-semibold ${s.text}`}>{s.label}</p>
                <p className="text-xs text-muted mt-0.5">🪑 {table.seats} ที่นั่ง</p>
              </div>
            )
          })}
          {tables.length === 0 && <div className="col-span-full card p-12 text-center text-muted text-sm">ไม่มีข้อมูลโต๊ะ</div>}
        </div>
      )}

      {/* Ready to serve tab */}
      {tab === 'ready' && (
        <div className="max-w-2xl space-y-2.5">
          {ready.map((item: any, i: number) => (
            <div key={item.id} className="card card-hover p-4 flex items-center gap-4 ring-2 ring-blue/20 anim-up" style={{ animationDelay: `${i * 40}ms` }}>
              <span className="text-2xl">🔔</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{item.menu_name} <span className="text-muted">×{item.quantity}</span></p>
                <p className="text-xs text-muted font-mono">order #{item.order_id?.slice(0, 8)}</p>
              </div>
              <button onClick={() => serveItem(item.id)} disabled={busyId[item.id]}
                className="inline-flex items-center gap-1.5 bg-green text-white px-4 py-2.5 rounded-2xl text-sm font-semibold hover:brightness-110 active:scale-95 transition-all disabled:opacity-60">
                {busyId[item.id] ? <Spinner size={14} /> : <CheckCircle2 size={15} />} เสิร์ฟแล้ว
              </button>
            </div>
          ))}
          {ready.length === 0 && (
            <div className="card p-16 text-center">
              <div className="text-5xl mb-3 floaty">✨</div>
              <p className="text-muted text-sm">ไม่มีรายการรอเสิร์ฟ</p>
            </div>
          )}
        </div>
      )}

      {/* Payment tab */}
      {tab === 'payment' && (
        <div className="max-w-2xl space-y-3">
          {paymentOrders.map((order: any, i: number) => {
            const ps = PAYMENT_STATUS[order.payment_status] ?? PAYMENT_STATUS.unpaid
            const hasSlip = order.payment_status === 'pending_verification' && order.slip_path
            return (
              <div key={order.id} className={`card p-4 anim-up ${order.payment_status === 'pending_verification' ? 'ring-2 ring-yellow/30' : ''}`}
                style={{ animationDelay: `${i * 40}ms` }}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="font-display font-bold text-xl">โต๊ะ {order.table?.label ?? '–'}</span>
                  <span className={`badge ml-auto ${ps.cls}`}>{ps.label}</span>
                </div>

                <p className="font-display font-bold text-2xl text-accent mb-3">฿{order.total?.toFixed(0)}</p>

                {/* Items list with cancel */}
                <div className="space-y-1.5 mb-3 border-t border-border pt-3">
                  {order.items?.filter((it: any) => it.status !== 'cancelled').map((item: any) => (
                    <div key={item.id} className="flex items-center gap-2 text-sm">
                      <span className="flex-1 truncate">{item.menu_name} <span className="text-muted">×{item.quantity}</span></span>
                      <span className={`text-xs shrink-0 ${item.status === 'pending' ? 'text-yellow' : item.status === 'cooking' ? 'text-accent' : item.status === 'ready' ? 'text-green' : 'text-muted'}`}>
                        {item.status === 'pending' ? 'รอทำ' : item.status === 'cooking' ? 'กำลังทำ' : item.status === 'ready' ? 'พร้อม' : 'เสิร์ฟแล้ว'}
                      </span>
                      {item.status === 'pending' && (
                        <button onClick={() => cancelItem(item.id)} disabled={busyId[`cancel_${item.id}`]}
                          className="w-6 h-6 rounded-lg bg-rose/10 text-rose flex items-center justify-center hover:bg-rose/20 transition-colors shrink-0 disabled:opacity-50">
                          {busyId[`cancel_${item.id}`] ? <Spinner size={10} /> : <X size={11} />}
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Slip preview */}
                {hasSlip && (
                  <div className="mb-3">
                    <p className="text-xs text-muted mb-1.5">สลิปที่ลูกค้าส่งมา</p>
                    <img src={order.slip_path} alt="slip"
                      className="w-28 h-28 rounded-xl object-cover border border-border cursor-pointer"
                      onClick={() => window.open(order.slip_path, '_blank')} />
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2">
                  <button onClick={() => payCash(order.id)} disabled={busyId[`cash_${order.id}`] || busyId[`verify_${order.id}`]}
                    className="btn-secondary flex-1 gap-1.5 text-sm disabled:opacity-60">
                    {busyId[`cash_${order.id}`] ? <Spinner size={14} /> : <Banknote size={15} />} ชำระสด
                  </button>
                  {order.payment_status === 'pending_verification' && (
                    <button onClick={() => verifyTransfer(order.id)} disabled={busyId[`verify_${order.id}`] || busyId[`cash_${order.id}`]}
                      className="btn-primary flex-1 gap-1.5 text-sm disabled:opacity-60">
                      {busyId[`verify_${order.id}`] ? <Spinner size={14} /> : <BadgeCheck size={15} />} ยืนยันโอน
                    </button>
                  )}
                </div>
              </div>
            )
          })}
          {paymentOrders.length === 0 && (
            <div className="card p-16 text-center">
              <div className="text-5xl mb-3">💳</div>
              <p className="text-muted text-sm">ไม่มีรายการรอชำระเงิน</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
