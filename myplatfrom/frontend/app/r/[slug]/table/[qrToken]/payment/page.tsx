'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api'
import QRCode from 'qrcode'
import { CheckCircle2, Clock, Flame, UtensilsCrossed, XCircle, PlusCircle, X, Banknote, QrCode, Star, Bell, BellRing } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useI18n, LangToggle } from '@/lib/i18n'
import { Spinner } from '@/components/Spinner'
import { enablePushForTable, notificationPermission } from '@/lib/push'

type PayMethod = 'qr' | 'cash' | null

export default function PaymentPage() {
  const params = useParams() as { slug: string; qrToken: string }
  const { t, lang, setLang } = useI18n()
  const [order, setOrder]           = useState<any>(null)
  const [tableInfo, setTableInfo]   = useState<any>(null)
  const [restaurant, setRestaurant] = useState<any>(null)
  const [promptpayQR, setPromptpayQR] = useState('')
  const [loading, setLoading]       = useState(true)
  const [busyId, setBusyId]         = useState<Record<string, boolean>>({})
  const [pulse, setPulse]           = useState(false)
  const tableIdRef = useRef<string | null>(null)

  const [payMethod, setPayMethod]   = useState<PayMethod>(null)
  const [submitting, setSubmitting] = useState(false)

  const [notifyState, setNotifyState] = useState<'default' | 'granted' | 'denied' | 'unsupported'>('default')
  const [notifyBusy, setNotifyBusy]   = useState(false)

  const [rating, setRating]               = useState(0)
  const [hoverStar, setHoverStar]         = useState(0)
  const [comment, setComment]             = useState('')
  const [reviewDone, setReviewDone]       = useState(false)
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
    const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3010'
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

  // เช็คสถานะ permission ตอนเปิดหน้า; ถ้าอนุญาตไว้แล้วให้ refresh subscription เงียบๆ
  useEffect(() => {
    const perm = notificationPermission()
    setNotifyState(perm === 'unsupported' ? 'unsupported' : perm)
    if (perm === 'granted') enablePushForTable(params.qrToken).catch(() => {})
  }, [params.qrToken])

  async function enableNotify() {
    if (notifyBusy) return
    setNotifyBusy(true)
    try {
      const ok = await enablePushForTable(params.qrToken)
      setNotifyState(ok ? 'granted' : (notificationPermission() === 'denied' ? 'denied' : 'default'))
    } catch {
      setNotifyState('default')
    } finally {
      setNotifyBusy(false)
    }
  }

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
    pending:   { label: t.statusPending,   icon: Clock,           cls: 'text-yellow', bg: 'bg-yellow/10' },
    cooking:   { label: t.statusCooking,   icon: Flame,           cls: 'text-accent', bg: 'bg-bg3' },
    ready:     { label: t.statusReady,     icon: CheckCircle2,    cls: 'text-teal',   bg: 'bg-teal/10' },
    served:    { label: t.statusServed,    icon: UtensilsCrossed, cls: 'text-green',  bg: 'bg-green/10' },
    cancelled: { label: t.statusCancelled, icon: XCircle,         cls: 'text-rose',   bg: 'bg-rose/10' },
  } as Record<string, { label: string; icon: any; cls: string; bg: string }>

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <div className="text-center">
        <div className="size-10 rounded-full border-[3px] border-accent border-t-transparent animate-spin mx-auto mb-3" />
        <p className="text-accent text-sm font-medium">{t.loading}</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen pb-10 bg-bg">
      {/* Header */}
      <div className="sticky top-0 bg-bg2/90 backdrop-blur border-b border-border px-4 py-3 shadow-sm">
        <div className="max-w-lg mx-auto flex items-center gap-2.5">
          <div className="size-9 rounded-xl bg-accent flex items-center justify-center text-lg shadow-md">🧾</div>
          <div className="flex-1">
            <p className="font-bold text-sm text-text leading-tight">{t.orderStatus}</p>
            <p className="text-xs text-accent font-medium">{t.table} {tableInfo?.label}</p>
          </div>
          <div className="flex items-center gap-2">
            <LangToggle lang={lang} setLang={setLang} />
            <div className="flex items-center gap-1.5">
              <span className={cn('size-2 rounded-full transition-all duration-300 bg-green animate-pulse', pulse && 'scale-125')} />
              <span className="text-xs text-muted">realtime</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">
        {!order ? (
          <div className="bg-bg2 rounded-2xl border border-border shadow-sm p-16 text-center mt-4">
            <UtensilsCrossed size={32} className="text-border2 mx-auto mb-3" />
            <p className="text-muted text-sm">{t.noOrders}</p>
          </div>
        ) : (
          <>
            {/* Order items */}
            <div className={`bg-bg2 rounded-2xl border shadow-sm p-4 transition-all duration-500 ${pulse ? 'border-green/40 shadow-green/10' : 'border-border'}`}>
              <p className="text-xs font-bold text-accent uppercase tracking-wider mb-4">{t.orderItems}</p>
              <div className="space-y-3">
                {order.items?.map((item: any) => {
                  const s = statusConfig[item.status] ?? statusConfig.pending
                  const Icon = s.icon
                  return (
                    <div key={item.id} className={`flex items-center gap-3 ${item.status === 'cancelled' ? 'opacity-40 line-through' : ''}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-text">
                          {item.menu_name} <span className="text-muted font-normal">×{item.quantity}</span>
                        </p>
                        {item.note && <p className="text-xs text-muted mt-0.5">📝 {item.note}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${s.bg}`}>
                          <Icon size={11} className={s.cls} aria-hidden="true" />
                          <span className={`text-xs font-semibold ${s.cls}`}>{s.label}</span>
                        </div>
                        <span className="text-sm font-bold text-accent">฿{(item.unit_price * item.quantity).toFixed(0)}</span>
                        {item.status === 'pending' && (
                          <button onClick={() => cancelItem(item.id)} disabled={busyId[item.id]}
                            aria-label={t.cancelItem}
                            className="size-6 rounded-lg bg-rose/10 text-rose flex items-center justify-center hover:bg-rose/20 transition-colors disabled:opacity-60">
                            {busyId[item.id] ? <Spinner size={10} /> : <X size={12} />}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="border-t border-border mt-4 pt-3 flex justify-between font-bold">
                <span className="text-text">{t.total}</span>
                <span className="text-accent text-lg">฿{order.total?.toFixed(0)}</span>
              </div>
            </div>

            {/* Notify-when-ready — แสดงเฉพาะตอนยังมีอาหารกำลังทำ */}
            {notifyState !== 'unsupported' && order.payment_status !== 'paid' && (
              notifyState === 'granted' ? (
                <div className="flex items-center gap-2.5 rounded-2xl border border-green/30 bg-green/10 px-4 py-3 text-green">
                  <BellRing size={18} aria-hidden="true" />
                  <span className="text-sm font-semibold">{t.notifyEnabled}</span>
                </div>
              ) : notifyState === 'denied' ? (
                <div className="flex items-center gap-2.5 rounded-2xl border border-border bg-bg2 px-4 py-3 text-muted">
                  <Bell size={18} aria-hidden="true" />
                  <span className="text-sm">{t.notifyBlocked}</span>
                </div>
              ) : (
                <button onClick={enableNotify} disabled={notifyBusy}
                  className="w-full flex items-center gap-3 rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-left transition-colors hover:bg-accent/20 disabled:opacity-60">
                  {notifyBusy ? <Spinner size={18} /> : <Bell size={18} className="text-accent shrink-0" aria-hidden="true" />}
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-accent">{t.notifyEnable}</span>
                    <span className="block text-xs text-muted mt-0.5">{t.notifyHint}</span>
                  </span>
                </button>
              )
            )}

            {/* Payment section */}
            {order.payment_status === 'unpaid' && (
              <div className="bg-bg2 rounded-2xl border border-border shadow-sm p-5 space-y-4">
                <div>
                  <p className="font-bold text-sm text-text">{t.payment}</p>
                  <p className="text-xs text-muted mt-0.5">{t.amountDue} <span className="text-accent font-bold">฿{order.total?.toFixed(0)}</span></p>
                </div>

                {payMethod === null && (
                  <div className="grid grid-cols-2 gap-3">
                    {restaurant?.promptpay ? (
                      <button onClick={() => setPayMethod('qr')}
                        className="flex flex-col items-center gap-2 p-4 rounded-2xl border-2 border-border2 hover:border-accent hover:bg-bg3 transition-all active:scale-[.98]">
                        <div className="size-12 rounded-xl bg-bg3 flex items-center justify-center">
                          <QrCode size={24} className="text-accent" />
                        </div>
                        <p className="text-sm font-bold text-text">สแกน QR</p>
                        <p className="text-xs text-muted">PromptPay</p>
                      </button>
                    ) : null}
                    <button onClick={() => { setPayMethod('cash'); requestPayment('cash') }}
                      className={cn(
                        'flex flex-col items-center gap-2 p-4 rounded-2xl border-2 border-yellow/30 hover:border-yellow/60 hover:bg-yellow/5 transition-all active:scale-[.98]',
                        !restaurant?.promptpay && 'col-span-2',
                      )}>
                      <div className="size-12 rounded-xl bg-yellow/10 flex items-center justify-center">
                        <Banknote size={24} className="text-yellow" />
                      </div>
                      <p className="text-sm font-bold text-text">เงินสด</p>
                      <p className="text-xs text-muted">แจ้งพนักงาน</p>
                    </button>
                  </div>
                )}

                {payMethod === 'qr' && (
                  <div className="space-y-4">
                    <button onClick={() => setPayMethod(null)} className="text-xs text-muted hover:text-text flex items-center gap-1">
                      ← เปลี่ยนวิธีชำระ
                    </button>
                    <div className="bg-bg3 rounded-2xl p-4 text-center border border-border">
                      {promptpayQR && (
                        <div className="flex justify-center mb-3">
                          <div className="bg-bg2 rounded-2xl p-2 shadow-md border border-border">
                            <img src={promptpayQR} alt="PromptPay QR" className="w-40 h-40 rounded-lg" />
                          </div>
                        </div>
                      )}
                      <p className="text-xs text-muted mb-1">PromptPay</p>
                      <p className="font-mono font-bold text-text text-xl">{restaurant?.promptpay}</p>
                      <p className="text-xs text-muted mt-1">{t.promptpayInstruction(order.total?.toFixed(0))}</p>
                    </div>
                    <button onClick={() => requestPayment('promptpay')} disabled={submitting}
                      className="btn-primary w-full py-3.5 flex items-center justify-center gap-2 disabled:opacity-60">
                      {submitting ? <Spinner size={16} /> : <CheckCircle2 size={16} />}
                      {submitting ? t.sending : 'ฉันโอนแล้ว'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {order.payment_status === 'pending_verification' && (
              <div className="bg-yellow/10 rounded-2xl border border-yellow/30 p-5 text-center space-y-2">
                <div className="size-12 rounded-full bg-yellow/20 flex items-center justify-center mx-auto">
                  {order.payment_method === 'cash'
                    ? <Banknote size={22} className="text-yellow" />
                    : <Clock size={22} className="text-yellow" />}
                </div>
                <p className="text-yellow font-bold text-sm">
                  {order.payment_method === 'cash' ? 'รอพนักงานรับเงิน' : t.waitingVerification}
                </p>
                <p className="text-xs text-yellow/70">{t.pleaseWait}</p>
              </div>
            )}

            {order.payment_status === 'unpaid' && (
              <a href={`/r/${params.slug}/table/${params.qrToken}/order`}
                className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl border-2 border-dashed border-border2 text-accent font-bold text-sm hover:bg-bg3 transition-colors">
                <PlusCircle size={18} /> {t.orderMore}
              </a>
            )}

            {order.payment_status === 'paid' && (
              <div className="space-y-4">
                <div className="bg-green/10 rounded-2xl border border-green/30 p-8 text-center">
                  <CheckCircle2 size={40} className="text-green mx-auto mb-3" />
                  <p className="font-bold text-green text-xl">{t.paymentComplete}</p>
                  <p className="text-muted text-sm mt-2">{t.thankYou}</p>
                </div>

                {!reviewDone ? (
                  <div className="bg-bg2 rounded-2xl border border-border shadow-sm p-5 space-y-4">
                    <div>
                      <p className="font-bold text-sm text-text">รีวิวประสบการณ์</p>
                      <p className="text-xs text-muted mt-0.5">ช่วยบอกความรู้สึกของคุณสักนิดนะครับ 🙏</p>
                    </div>
                    <div className="flex justify-center gap-2">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button key={star}
                          onMouseEnter={() => setHoverStar(star)}
                          onMouseLeave={() => setHoverStar(0)}
                          onClick={() => setRating(star)}
                          aria-label={`${star} ดาว`}
                          className="transition-transform active:scale-90">
                          <Star
                            size={36}
                            className={cn('transition-colors',
                              star <= (hoverStar || rating)
                                ? 'fill-yellow text-yellow'
                                : 'text-border2')}
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
                          className="input w-full resize-none"
                        />
                        <button onClick={submitReview} disabled={reviewSubmitting}
                          className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-60">
                          {reviewSubmitting ? <Spinner size={16} /> : '✓'}
                          {reviewSubmitting ? 'กำลังส่ง...' : 'ส่งรีวิว'}
                        </button>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="bg-bg3 rounded-2xl border border-border p-5 text-center">
                    <p className="text-2xl mb-1">🌟</p>
                    <p className="font-bold text-accent text-sm">ขอบคุณสำหรับรีวิว!</p>
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
