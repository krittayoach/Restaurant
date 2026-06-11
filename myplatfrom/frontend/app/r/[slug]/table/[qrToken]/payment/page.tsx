'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api'
import QRCode from 'qrcode'
import { CheckCircle2, Clock, Flame, UtensilsCrossed, XCircle, PlusCircle, X, Banknote, QrCode, Star } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useI18n, LangToggle } from '@/lib/i18n'
import { Spinner } from '@/components/Spinner'

type PayMethod = 'qr' | 'cash' | null

export default function PaymentPage() {
  const params = useParams() as { slug: string; qrToken: string }
  const { t, lang, setLang } = useI18n()
  const [order, setOrder]         = useState<any>(null)
  const [tableInfo, setTableInfo] = useState<any>(null)
  const [restaurant, setRestaurant] = useState<any>(null)
  const [promptpayQR, setPromptpayQR] = useState('')
  const [loading, setLoading]     = useState(true)
  const [busyId, setBusyId]       = useState<Record<string, boolean>>({})
  const [pulse, setPulse]         = useState(false)
  const tableIdRef = useRef<string | null>(null)

  // payment flow
  const [payMethod, setPayMethod]   = useState<PayMethod>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted]   = useState(false)

  // review
  const [rating, setRating]         = useState(0)
  const [hoverStar, setHoverStar]   = useState(0)
  const [comment, setComment]       = useState('')
  const [reviewDone, setReviewDone] = useState(false)
  const [reviewSubmitting, setReviewSubmitting] = useState(false)

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
      if (orderList[0].payment_status === 'paid') sessionStorage.removeItem('currentOrderId')
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
    const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
    let es: EventSource
    let retryTimer: ReturnType<typeof setTimeout>
    function connect() {
      if (!tableIdRef.current) { retryTimer = setTimeout(connect, 300); return }
      es = new EventSource(`${API}/tables/${tableIdRef.current}/stream?qrToken=${params.qrToken}`)
      es.onmessage = () => { load(); setPulse(true); setTimeout(() => setPulse(false), 1500) }
      es.onerror = () => { es.close(); retryTimer = setTimeout(connect, 3000) }
    }
    retryTimer = setTimeout(connect, 500)
    return () => { clearTimeout(retryTimer); es?.close() }
  }, [])

  async function cancelItem(itemId: string) {
    if (!order) return
    setBusyId(b => ({ ...b, [itemId]: true }))
    try { await api.patch(`/orders/${order.id}/items/${itemId}/cancel`, {}); load() }
    finally { setBusyId(b => ({ ...b, [itemId]: false })) }
  }

  async function requestPayment(method: 'promptpay' | 'cash') {
    if (!order) return
    setSubmitting(true)
    try {
      await api.post('/payment/request', { orderId: order.id, method })
      setSubmitted(true)
      load()
    } catch {
      alert(t.errorTryAgain)
    } finally {
      setSubmitting(false)
    }
  }

  async function submitReview() {
    if (!order || rating === 0) return
    setReviewSubmitting(true)
    try {
      await api.post('/reviews', { orderId: order.id, rating, comment: comment.trim() || undefined })
      setReviewDone(true)
    } catch {} finally {
      setReviewSubmitting(false)
    }
  }

  const statusConfig = {
    pending:   { label: t.statusPending,   icon: Clock,           cls: 'text-amber-500',  bg: 'bg-amber-50' },
    cooking:   { label: t.statusCooking,   icon: Flame,           cls: 'text-orange-500', bg: 'bg-orange-50' },
    ready:     { label: t.statusReady,     icon: CheckCircle2,    cls: 'text-teal-500',   bg: 'bg-teal-50' },
    served:    { label: t.statusServed,    icon: UtensilsCrossed, cls: 'text-green-500',  bg: 'bg-green-50' },
    cancelled: { label: t.statusCancelled, icon: XCircle,         cls: 'text-rose-400',   bg: 'bg-rose-50' },
  } as Record<string, { label: string; icon: any; cls: string; bg: string }>

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <div className="text-center">
        <div className="size-10 rounded-full border-[3px] border-accent border-t-transparent animate-spin mx-auto mb-3" />
        <p className="text-orange-400 text-sm font-medium">{t.loading}</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen pb-10 bg-bg">
      {/* Header */}
      <div className="sticky top-0 bg-white/90 backdrop-blur border-b border-orange-100 px-4 py-3 shadow-sm">
        <div className="max-w-lg mx-auto flex items-center gap-2.5">
          <div className="size-9 rounded-xl bg-accent flex items-center justify-center text-lg shadow-md">🧾</div>
          <div className="flex-1">
            <p className="font-bold text-sm text-gray-800 leading-tight">{t.orderStatus}</p>
            <p className="text-xs text-orange-400 font-medium">{t.table} {tableInfo?.label}</p>
          </div>
          <div className="flex items-center gap-2">
            <LangToggle lang={lang} setLang={setLang} />
            <div className="flex items-center gap-1.5">
              <span className={cn('size-2 rounded-full transition-all duration-300 bg-green animate-pulse', pulse && 'scale-125')} />
              <span className="text-xs text-gray-400">realtime</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">
        {!order ? (
          <div className="bg-white rounded-2xl border border-orange-100 shadow-sm p-16 text-center mt-4">
            <UtensilsCrossed size={32} className="text-orange-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">{t.noOrders}</p>
          </div>
        ) : (
          <>
            {/* Order items */}
            <div className={`bg-white rounded-2xl border shadow-sm p-4 transition-all duration-500 ${pulse ? 'border-green-300 shadow-green-100' : 'border-orange-100'}`}>
              <p className="text-xs font-bold text-orange-400 uppercase tracking-wider mb-4">{t.orderItems}</p>
              <div className="space-y-3">
                {order.items?.map((item: any) => {
                  const s = statusConfig[item.status] ?? statusConfig.pending
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
                          <button onClick={() => cancelItem(item.id)} disabled={busyId[item.id]}
                            className="w-6 h-6 rounded-lg bg-rose-50 text-rose-400 flex items-center justify-center hover:bg-rose-100 transition-colors disabled:opacity-60"
                            title={t.cancelItem}>
                            {busyId[item.id] ? <Spinner size={10} /> : <X size={12} />}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="border-t border-orange-100 mt-4 pt-3 flex justify-between font-bold">
                <span className="text-gray-600">{t.total}</span>
                <span className="text-orange-500 text-lg">฿{order.total?.toFixed(0)}</span>
              </div>
            </div>

            {/* Payment section */}
            {order.payment_status === 'unpaid' && (
              <div className="bg-white rounded-2xl border border-orange-100 shadow-sm p-5 space-y-4">
                <div>
                  <p className="font-bold text-sm text-gray-800">{t.payment}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{t.amountDue} <span className="text-orange-500 font-bold">฿{order.total?.toFixed(0)}</span></p>
                </div>

                {payMethod === null && (
                  <div className="grid grid-cols-2 gap-3">
                    {/* QR option — show only if restaurant has promptpay */}
                    {restaurant?.promptpay ? (
                      <button onClick={() => setPayMethod('qr')}
                        className="flex flex-col items-center gap-2 p-4 rounded-2xl border-2 border-orange-200 hover:border-accent hover:bg-orange-50/40 transition-all active:scale-[.98]">
                        <div className="size-12 rounded-xl bg-orange-100 flex items-center justify-center">
                          <QrCode size={24} className="text-accent" />
                        </div>
                        <p className="text-sm font-bold text-gray-800">สแกน QR</p>
                        <p className="text-xs text-gray-400">PromptPay</p>
                      </button>
                    ) : null}
                    <button onClick={() => { setPayMethod('cash'); requestPayment('cash') }}
                      className={cn('flex flex-col items-center gap-2 p-4 rounded-2xl border-2 border-yellow/30 hover:border-yellow/60 hover:bg-yellow/5 transition-all active:scale-[.98]',
                        !restaurant?.promptpay && 'col-span-2')}>
                      <div className="size-12 rounded-xl bg-yellow/10 flex items-center justify-center">
                        <Banknote size={24} className="text-yellow" />
                      </div>
                      <p className="text-sm font-bold text-gray-800">เงินสด</p>
                      <p className="text-xs text-gray-400">แจ้งพนักงาน</p>
                    </button>
                  </div>
                )}

                {/* QR flow */}
                {payMethod === 'qr' && !submitted && (
                  <div className="space-y-4">
                    <button onClick={() => setPayMethod(null)} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                      ← เปลี่ยนวิธีชำระ
                    </button>
                    <div className="bg-orange-50/50 rounded-2xl p-4 text-center border border-orange-100">
                      {promptpayQR && (
                        <div className="flex justify-center mb-3">
                          <div className="bg-white rounded-2xl p-2 shadow-md border border-orange-100">
                            <img src={promptpayQR} alt="PromptPay QR" className="w-40 h-40 rounded-lg" />
                          </div>
                        </div>
                      )}
                      <p className="text-xs text-gray-400 mb-1">PromptPay</p>
                      <p className="font-mono font-bold text-gray-800 text-xl">{restaurant?.promptpay}</p>
                      <p className="text-xs text-gray-400 mt-1">{t.promptpayInstruction(order.total?.toFixed(0))}</p>
                    </div>
                    <button onClick={() => requestPayment('promptpay')} disabled={submitting}
                      className="flex items-center justify-center gap-2 w-full bg-accent text-white font-bold py-3.5 rounded-xl shadow-md shadow-accent/20 hover:bg-accent2 transition-all active:scale-[.98] disabled:opacity-60">
                      {submitting ? <Spinner size={16} /> : <CheckCircle2 size={16} />}
                      {submitting ? t.sending : 'ฉันโอนแล้ว'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {order.payment_status === 'pending_verification' && (
              <div className="bg-amber-50 rounded-2xl border border-amber-200 p-5 text-center space-y-2">
                <div className="size-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
                  {order.payment_method === 'cash'
                    ? <Banknote size={22} className="text-amber-500" />
                    : <Clock size={22} className="text-amber-500" />}
                </div>
                <p className="text-amber-600 font-bold text-sm">
                  {order.payment_method === 'cash' ? 'รอพนักงานรับเงิน' : t.waitingVerification}
                </p>
                <p className="text-xs text-amber-400">{t.pleaseWait}</p>
              </div>
            )}

            {order.payment_status === 'unpaid' && (
              <a href={`/r/${params.slug}/table/${params.qrToken}/order`}
                className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl border-2 border-dashed border-orange-300 text-orange-400 font-bold text-sm hover:bg-orange-50 transition-colors">
                <PlusCircle size={18} /> {t.orderMore}
              </a>
            )}

            {order.payment_status === 'paid' && (
              <div className="space-y-4">
                <div className="bg-green-50 rounded-2xl border border-green-200 p-8 text-center">
                  <CheckCircle2 size={40} className="text-green-500 mx-auto mb-3" />
                  <p className="font-bold text-green-600 text-xl">{t.paymentComplete}</p>
                  <p className="text-gray-400 text-sm mt-2">{t.thankYou}</p>
                </div>

                {/* Review form */}
                {!reviewDone ? (
                  <div className="bg-white rounded-2xl border border-orange-100 shadow-sm p-5 space-y-4">
                    <div>
                      <p className="font-bold text-sm text-gray-800">รีวิวประสบการณ์</p>
                      <p className="text-xs text-gray-400 mt-0.5">ช่วยบอกความรู้สึกของคุณสักนิดนะครับ 🙏</p>
                    </div>
                    <div className="flex justify-center gap-2">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button key={star}
                          onMouseEnter={() => setHoverStar(star)}
                          onMouseLeave={() => setHoverStar(0)}
                          onClick={() => setRating(star)}
                          className="transition-transform active:scale-90">
                          <Star
                            size={36}
                            className={cn('transition-colors',
                              star <= (hoverStar || rating)
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-gray-200')}
                          />
                        </button>
                      ))}
                    </div>
                    {rating > 0 && (
                      <>
                        <textarea
                          value={comment}
                          onChange={e => setComment(e.target.value)}
                          placeholder="บอกความรู้สึกเพิ่มเติม... (ไม่บังคับ)"
                          rows={2}
                          className="w-full rounded-xl border border-orange-200 bg-orange-50/30 px-3 py-2.5 text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:border-accent resize-none"
                        />
                        <button onClick={submitReview} disabled={reviewSubmitting}
                          className="flex items-center justify-center gap-2 w-full bg-accent text-white font-bold py-3 rounded-xl shadow-md shadow-accent/20 hover:brightness-110 active:scale-[.98] transition-all disabled:opacity-60">
                          {reviewSubmitting ? <Spinner size={16} /> : '✓'}
                          {reviewSubmitting ? 'กำลังส่ง...' : 'ส่งรีวิว'}
                        </button>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="bg-orange-50 rounded-2xl border border-orange-100 p-5 text-center">
                    <p className="text-2xl mb-1">🌟</p>
                    <p className="font-bold text-orange-500 text-sm">ขอบคุณสำหรับรีวิว!</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
