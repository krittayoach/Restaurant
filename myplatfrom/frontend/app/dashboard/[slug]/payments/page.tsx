'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { CheckCircle, XCircle, RefreshCw, ImageIcon, CalendarClock, Users, Phone, Clock, CreditCard } from 'lucide-react'
import { Spinner } from '@/components/Spinner'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3010'

function getToken() {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('token')
}

function authHeaders() {
  return { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' }
}

type OrderSlip = {
  id: string
  total: number
  payment_status: string
  slip_path: string | null
  created_at: string
  table: { label: string }
  items: { menu_name: string; quantity: number; unit_price: number }[]
}

type PreOrderSlip = {
  id: string
  customer_name: string
  customer_phone: string
  party_size: number
  reserved_at: string
  table_label: string
  pre_order_items: { menu_name: string; quantity: number; unit_price: number }[]
  pre_order_total: number
  pre_order_payment: string
  pre_order_slip: string | null
}

export default function PaymentsPage() {
  const { slug } = useParams() as { slug: string }
  const [orderSlips, setOrderSlips] = useState<OrderSlip[]>([])
  const [preOrders, setPreOrders] = useState<PreOrderSlip[]>([])
  const [loading, setLoading] = useState(true)
  const [viewSlip, setViewSlip] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [r1, r2] = await Promise.all([
        fetch(`${API}/orders/pending-payment`, { headers: authHeaders() }),
        fetch(`${API}/reservations/pending-preorders`, { headers: authHeaders() }),
      ])
      const orders: OrderSlip[] = r1.ok ? await r1.json() : []
      const pre: PreOrderSlip[] = r2.ok ? await r2.json() : []
      setOrderSlips(orders.filter(o => o.payment_status === 'pending_verification'))
      setPreOrders(pre)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function verifyOrder(orderId: string, approve: boolean) {
    setActionLoading(orderId)
    try {
      const endpoint = approve ? '/payment/verify' : '/payment/refund'
      await fetch(`${API}${endpoint}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ orderId }),
      })
      await load()
    } finally { setActionLoading(null) }
  }

  async function verifyPreOrder(id: string, action: 'approve' | 'reject') {
    setActionLoading(id)
    try {
      await fetch(`${API}/reservations/${id}/pre-order-payment`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ action }),
      })
      await load()
    } finally { setActionLoading(null) }
  }

  const total = orderSlips.length + preOrders.length

  function formatDateTime(iso: string) {
    return new Date(iso).toLocaleString('th-TH', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-text flex items-center gap-2">
            <CreditCard size={22} className="text-accent" />
            ตรวจสอบชำระเงิน
          </h1>
          <p className="text-sm text-muted mt-0.5">
            {loading ? 'กำลังโหลด…' : total === 0 ? 'ไม่มีรายการรอตรวจสอบ' : `${total} รายการรอตรวจสอบ`}
          </p>
        </div>
        <button onClick={load} disabled={loading}
          className="w-9 h-9 rounded-2xl bg-bg3 flex items-center justify-center text-muted hover:text-text transition-colors">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Empty state */}
      {!loading && total === 0 && (
        <div className="card p-10 text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center mx-auto">
            <CheckCircle size={28} className="text-green-500" />
          </div>
          <p className="font-semibold text-text">ทุกรายการได้รับการตรวจสอบแล้ว</p>
          <p className="text-sm text-muted">ไม่มีสลิปรอยืนยัน</p>
        </div>
      )}

      {/* Order slips */}
      {orderSlips.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-text px-1">สลิปโอนเงิน — ออเดอร์ ({orderSlips.length})</h2>
          {orderSlips.map(order => (
            <div key={order.id} className="card p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-text">โต๊ะ {order.table.label}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium">รอยืนยัน</span>
                  </div>
                  <p className="text-xs text-muted mt-1 flex items-center gap-1">
                    <Clock size={10} />{formatDateTime(order.created_at)}
                  </p>
                  <div className="mt-2 space-y-0.5">
                    {order.items.map((item, i) => (
                      <p key={i} className="text-xs text-muted">
                        {item.menu_name} × {item.quantity}
                        <span className="ml-1 text-text font-medium">฿{(item.unit_price * item.quantity).toFixed(0)}</span>
                      </p>
                    ))}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-display font-bold text-xl text-accent">฿{order.total.toFixed(0)}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {order.slip_path ? (
                  <button onClick={() => setViewSlip(order.slip_path!)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-bg3 text-muted hover:text-text transition-colors">
                    <ImageIcon size={13} />ดูสลิป
                  </button>
                ) : (
                  <span className="text-xs text-muted italic">ไม่มีสลิป</span>
                )}
                <div className="flex-1" />
                <button onClick={() => verifyOrder(order.id, false)}
                  disabled={actionLoading === order.id}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-colors font-medium disabled:opacity-50">
                  {actionLoading === order.id ? <Spinner size={12} /> : <XCircle size={13} />}ปฏิเสธ
                </button>
                <button onClick={() => verifyOrder(order.id, true)}
                  disabled={actionLoading === order.id}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-green-50 text-green-600 hover:bg-green-100 transition-colors font-medium disabled:opacity-50">
                  {actionLoading === order.id ? <Spinner size={12} /> : <CheckCircle size={13} />}อนุมัติ
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Pre-order slips */}
      {preOrders.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-text px-1">สลิป Pre-order — การจอง ({preOrders.length})</h2>
          {preOrders.map(res => (
            <div key={res.id} className="card p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-text">โต๊ะ {res.table_label}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium">รอยืนยัน</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-muted">
                    <span className="flex items-center gap-1"><CalendarClock size={10} />{formatDateTime(res.reserved_at)}</span>
                    <span className="flex items-center gap-1"><Users size={10} />{res.party_size} คน</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs text-muted">
                    <span className="font-medium text-text">{res.customer_name}</span>
                    <span className="flex items-center gap-1"><Phone size={10} />{res.customer_phone}</span>
                  </div>
                  {res.pre_order_items?.length > 0 && (
                    <div className="mt-2 space-y-0.5">
                      {res.pre_order_items.map((item, i) => (
                        <p key={i} className="text-xs text-muted">
                          {item.menu_name} × {item.quantity}
                          <span className="ml-1 text-text font-medium">฿{(item.unit_price * item.quantity).toFixed(0)}</span>
                        </p>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-display font-bold text-xl text-accent">฿{res.pre_order_total?.toFixed(0)}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {res.pre_order_slip ? (
                  <button onClick={() => setViewSlip(res.pre_order_slip!)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-bg3 text-muted hover:text-text transition-colors">
                    <ImageIcon size={13} />ดูสลิป
                  </button>
                ) : (
                  <span className="text-xs text-muted italic">ไม่มีสลิป</span>
                )}
                <div className="flex-1" />
                <button onClick={() => verifyPreOrder(res.id, 'reject')}
                  disabled={actionLoading === res.id}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-colors font-medium disabled:opacity-50">
                  {actionLoading === res.id ? <Spinner size={12} /> : <XCircle size={13} />}ปฏิเสธ
                </button>
                <button onClick={() => verifyPreOrder(res.id, 'approve')}
                  disabled={actionLoading === res.id}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-green-50 text-green-600 hover:bg-green-100 transition-colors font-medium disabled:opacity-50">
                  {actionLoading === res.id ? <Spinner size={12} /> : <CheckCircle size={13} />}อนุมัติ
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Slip viewer modal */}
      {viewSlip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setViewSlip(null)}>
          <div className="relative max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <img src={viewSlip} alt="สลิป" className="w-full rounded-2xl shadow-2xl object-contain max-h-[80vh]" />
            <button onClick={() => setViewSlip(null)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white text-lg leading-none">
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
