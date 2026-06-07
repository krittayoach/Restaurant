'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api'
import QRCode from 'qrcode'
import { CheckCircle2, Clock, Flame, UtensilsCrossed, XCircle, Upload, ImagePlus, PlusCircle, X } from 'lucide-react'

const STATUS_CONFIG: Record<string, { label: string; icon: any; cls: string; bg: string }> = {
  pending:  { label: 'รอรับออเดอร์', icon: Clock,           cls: 'text-amber-500',  bg: 'bg-amber-50' },
  cooking:  { label: 'กำลังทำ',      icon: Flame,           cls: 'text-orange-500', bg: 'bg-orange-50' },
  ready:    { label: 'พร้อมเสิร์ฟ',  icon: CheckCircle2,    cls: 'text-teal-500',   bg: 'bg-teal-50' },
  served:   { label: 'เสิร์ฟแล้ว',   icon: UtensilsCrossed, cls: 'text-green-500',  bg: 'bg-green-50' },
  cancelled:{ label: 'ยกเลิก',       icon: XCircle,         cls: 'text-rose-400',   bg: 'bg-rose-50' },
}

export default function PaymentPage() {
  const params = useParams() as { slug: string; qrToken: string }
  const [order, setOrder] = useState<any>(null)
  const [tableInfo, setTableInfo] = useState<any>(null)
  const [restaurant, setRestaurant] = useState<any>(null)
  const [promptpayQR, setPromptpayQR] = useState('')
  const [loading, setLoading] = useState(true)
  const [slipPreview, setSlipPreview] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitDone, setSubmitDone] = useState(false)
  const [pulse, setPulse] = useState(false)
  const tableIdRef = useRef<string | null>(null)

  async function load() {
    const table = await api.get(`/tables/resolve/${params.qrToken}?slug=${params.slug}`)
    setTableInfo(table)
    tableIdRef.current = table.id
    const [orderList, rest] = await Promise.all([
      api.get(`/orders/table/${table.id}?restaurantId=${table.restaurant_id}`),
      api.get(`/restaurants/${params.slug}`).catch(() => null),
    ])
    if (orderList.length > 0) {
      setOrder(orderList[0])
      if (orderList[0].payment_status === 'paid') {
        sessionStorage.removeItem('currentOrderId')
      }
    }
    setRestaurant(rest)
    if (rest?.promptpay) {
      const img = await QRCode.toDataURL(rest.promptpay, {
        width: 220, margin: 2, color: { dark: '#7c2d12', light: '#ffffff' },
      })
      setPromptpayQR(img)
    }
    setLoading(false)
  }

  useEffect(() => {
    load()

    // SSE realtime — ต่อหลัง load เพื่อให้มี tableId แล้ว
    const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
    let es: EventSource
    let retryTimer: ReturnType<typeof setTimeout>

    function connect() {
      // รอให้ tableId พร้อม
      if (!tableIdRef.current) { retryTimer = setTimeout(connect, 300); return }
      es = new EventSource(`${API}/tables/${tableIdRef.current}/stream?qrToken=${params.qrToken}`)
      es.onmessage = () => { load(); setPulse(true); setTimeout(() => setPulse(false), 1500) }
      es.onerror = () => { es.close(); retryTimer = setTimeout(connect, 3000) }
    }
    retryTimer = setTimeout(connect, 500)

    return () => { clearTimeout(retryTimer); es?.close() }
  }, [])

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setSlipPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  async function cancelItem(itemId: string) {
    if (!order) return
    await api.patch(`/orders/${order.id}/items/${itemId}/cancel`, {})
    load()
  }

  async function submitSlip() {
    if (!slipPreview || !order) return
    setSubmitting(true)
    try {
      await api.post('/payment/submit', { orderId: order.id, slipPath: slipPreview })
      setSubmitDone(true)
      load()
    } catch {
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(160deg, #fff8f0 0%, #fff3e6 100%)' }}>
      <div className="text-center">
        <div className="w-10 h-10 rounded-full border-[3px] border-orange-400 border-t-transparent animate-spin mx-auto mb-3" />
        <p className="text-orange-400 text-sm font-medium">กำลังโหลด...</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen pb-10" style={{ background: 'linear-gradient(160deg, #fff8f0 0%, #fff3e6 100%)' }}>
      {/* Header */}
      <div className="sticky top-0 bg-white/90 backdrop-blur border-b border-orange-100 px-4 py-3 shadow-sm">
        <div className="max-w-lg mx-auto flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-400 to-rose-400 flex items-center justify-center text-lg shadow-md">
            🧾
          </div>
          <div className="flex-1">
            <p className="font-bold text-sm text-gray-800 leading-tight">สถานะออเดอร์</p>
            <p className="text-xs text-orange-400 font-medium">โต๊ะ {tableInfo?.label}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full transition-all duration-300 ${pulse ? 'bg-green-400 scale-125' : 'bg-green-400'} animate-pulse`} />
            <span className="text-xs text-gray-400">realtime</span>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">
        {!order ? (
          <div className="bg-white rounded-2xl border border-orange-100 shadow-sm p-16 text-center mt-4">
            <UtensilsCrossed size={32} className="text-orange-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">ยังไม่มีออเดอร์</p>
          </div>
        ) : (
          <>
            {/* Order items */}
            <div className={`bg-white rounded-2xl border shadow-sm p-4 transition-all duration-500 ${pulse ? 'border-green-300 shadow-green-100' : 'border-orange-100'}`}>
              <p className="text-xs font-bold text-orange-400 uppercase tracking-wider mb-4">รายการอาหาร</p>
              <div className="space-y-3">
                {order.items?.map((item: any) => {
                  const s = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.pending
                  const Icon = s.icon
                  return (
                    <div key={item.id} className={`flex items-center gap-3 ${item.status === 'cancelled' ? 'opacity-40 line-through' : ''}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800">
                          {item.menu_name} <span className="text-gray-400 font-normal">×{item.quantity}</span>
                        </p>
                        {item.note && <p className="text-xs text-gray-400 mt-0.5">📝 {item.note}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${s.bg}`}>
                          <Icon size={11} className={s.cls} />
                          <span className={`text-xs font-semibold ${s.cls}`}>{s.label}</span>
                        </div>
                        <span className="text-sm font-bold text-orange-500">฿{(item.unit_price * item.quantity).toFixed(0)}</span>
                        {item.status === 'pending' && (
                          <button onClick={() => cancelItem(item.id)}
                            className="w-6 h-6 rounded-lg bg-rose-50 text-rose-400 flex items-center justify-center hover:bg-rose-100 transition-colors"
                            title="ยกเลิกรายการนี้">
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="border-t border-orange-100 mt-4 pt-3 flex justify-between font-bold">
                <span className="text-gray-600">รวม</span>
                <span className="text-orange-500 text-lg">฿{order.total?.toFixed(0)}</span>
              </div>
            </div>

            {/* Payment section */}
            {order.payment_status === 'unpaid' && (
              <div className="bg-white rounded-2xl border border-orange-100 shadow-sm p-5 space-y-4">
                <div>
                  <p className="font-bold text-sm text-gray-800">ชำระเงิน</p>
                  <p className="text-xs text-gray-400 mt-0.5">ยอดชำระ <span className="text-orange-500 font-bold">฿{order.total?.toFixed(0)}</span></p>
                </div>

                {restaurant?.promptpay ? (
                  <>
                    <div className="bg-gradient-to-br from-orange-50 to-rose-50 rounded-2xl p-4 text-center border border-orange-100">
                      {promptpayQR && (
                        <div className="flex justify-center mb-3">
                          <div className="bg-white rounded-2xl p-2 shadow-md border border-orange-100">
                            <img src={promptpayQR} alt="PromptPay QR" className="w-40 h-40 rounded-lg" />
                          </div>
                        </div>
                      )}
                      <p className="text-xs text-gray-400 mb-1">PromptPay</p>
                      <p className="font-mono font-bold text-gray-800 text-xl">{restaurant.promptpay}</p>
                      <p className="text-xs text-gray-400 mt-1">กรุณาโอน ฿{order.total?.toFixed(0)} แล้วแนบสลิปด้านล่าง</p>
                    </div>

                    <div>
                      <p className="text-xs font-bold text-orange-400 mb-2">แนบสลิปการโอนเงิน</p>
                      <label className={`flex flex-col items-center gap-2 border-2 border-dashed rounded-2xl p-4 cursor-pointer transition-colors ${slipPreview ? 'border-orange-300 bg-orange-50/50' : 'border-orange-200 hover:border-orange-300 hover:bg-orange-50/30'}`}>
                        {slipPreview ? (
                          <img src={slipPreview} alt="slip preview" className="max-h-48 rounded-xl object-contain" />
                        ) : (
                          <>
                            <ImagePlus size={28} className="text-orange-300" />
                            <span className="text-sm text-gray-400">แตะเพื่อเลือกรูปสลิป</span>
                          </>
                        )}
                        <input type="file" accept="image/*" className="hidden" onChange={onFileChange} />
                      </label>
                      {slipPreview && !submitDone && (
                        <button onClick={submitSlip} disabled={submitting}
                          className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-orange-400 to-rose-400 text-white font-bold py-3 rounded-xl mt-3 shadow-md shadow-orange-200 hover:shadow-lg transition-all active:scale-[.98] disabled:opacity-60">
                          <Upload size={16} />
                          {submitting ? 'กำลังส่ง...' : 'ส่งสลิปให้พนักงาน'}
                        </button>
                      )}
                      {submitDone && (
                        <p className="text-center text-sm text-teal-500 mt-2 font-semibold">✓ ส่งสลิปแล้ว รอพนักงานยืนยัน</p>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="bg-orange-50 rounded-2xl p-5 text-center border border-orange-100">
                    <p className="text-3xl mb-2">🙋</p>
                    <p className="text-sm font-bold text-gray-700">กรุณาแจ้งพนักงาน</p>
                    <p className="text-xs text-gray-400 mt-1">เพื่อชำระเงิน</p>
                  </div>
                )}
              </div>
            )}

            {order.payment_status === 'pending_verification' && (
              <div className="bg-amber-50 rounded-2xl border border-amber-200 p-5 text-center">
                <Clock size={28} className="text-amber-500 mx-auto mb-2" />
                <p className="text-amber-600 font-bold text-sm">รอพนักงานยืนยันการชำระเงิน</p>
                <p className="text-xs text-amber-400 mt-1">โปรดรอสักครู่...</p>
              </div>
            )}

            {order.payment_status === 'unpaid' && (
              <a href={`/r/${params.slug}/table/${params.qrToken}/order`}
                className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl border-2 border-dashed border-orange-300 text-orange-400 font-bold text-sm hover:bg-orange-50 transition-colors">
                <PlusCircle size={18} /> สั่งอาหารเพิ่ม
              </a>
            )}

            {order.payment_status === 'paid' && (
              <div className="bg-green-50 rounded-2xl border border-green-200 p-8 text-center">
                <CheckCircle2 size={40} className="text-green-500 mx-auto mb-3" />
                <p className="font-bold text-green-600 text-xl">ชำระเงินเรียบร้อย</p>
                <p className="text-gray-400 text-sm mt-2">ขอบคุณที่ใช้บริการ 🙏</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
