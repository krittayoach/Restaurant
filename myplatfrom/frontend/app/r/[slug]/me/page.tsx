'use client'
import { useState } from 'react'
import { useParams } from 'next/navigation'
import { Phone, Star, CalendarClock, ChevronRight, ArrowUpCircle, ArrowDownCircle, Users, Clock, CheckCircle, XCircle } from 'lucide-react'
import { useI18n, LangToggle } from '@/lib/i18n'
import Link from 'next/link'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

const RES_STATUS: Record<string, { label: string; th: string; color: string }> = {
  confirmed: { label: 'Confirmed',  th: 'ยืนยันแล้ว',  color: 'text-blue-600 bg-blue-50' },
  seated:    { label: 'Seated',     th: 'เข้านั่งแล้ว', color: 'text-green-600 bg-green-50' },
  cancelled: { label: 'Cancelled',  th: 'ยกเลิก',       color: 'text-gray-400 bg-gray-50' },
  no_show:   { label: 'No Show',    th: 'ไม่มา',        color: 'text-rose-500 bg-rose-50' },
}

export default function CustomerPortalPage() {
  const { slug } = useParams() as { slug: string }
  const { t, lang, setLang } = useI18n()

  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState('')

  async function lookup() {
    const normalized = phone.replace(/\D/g, '')
    if (normalized.length < 9) { setError('กรุณากรอกเบอร์โทรให้ครบ'); return }
    setLoading(true); setError(''); setData(null)
    try {
      const res = await fetch(`${API}/customers/lookup?slug=${slug}&phone=${normalized}`)
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'เกิดข้อผิดพลาด'); return }
      setData(json)
    } catch { setError('ไม่สามารถเชื่อมต่อได้') }
    finally { setLoading(false) }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-GB', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    })
  }
  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString(lang === 'th' ? 'th-TH' : 'en-GB', { hour: '2-digit', minute: '2-digit' })
  }

  const redeemableDiscount = data?.customer ? Math.floor(data.customer.total_points / (data.meta?.bahtPerPoint ?? 1)) : 0

  return (
    <div className="min-h-screen bg-bg2 py-10 px-4">
      <div className="max-w-md mx-auto space-y-4">
        {/* Header */}
        <div className="text-center relative">
          <div className="absolute right-0 top-0"><LangToggle lang={lang} setLang={setLang} /></div>
          <div className="w-14 h-14 rounded-2xl bg-orange-100 flex items-center justify-center mx-auto mb-3">
            <Star size={28} className="text-orange-400" />
          </div>
          <h1 className="font-display font-bold text-2xl text-text">
            {lang === 'th' ? 'แต้มสะสม & การจอง' : 'Rewards & Bookings'}
          </h1>
          <p className="text-muted text-sm mt-1">
            {lang === 'th' ? 'ดูแต้มและประวัติการจองของคุณ' : 'Check your points and booking history'}
          </p>
        </div>

        {/* Phone lookup */}
        <div className="card p-6">
          <label className="text-xs text-muted mb-1.5 flex items-center gap-1.5 font-medium">
            <Phone size={12} />{lang === 'th' ? 'เบอร์โทร' : 'Phone Number'}
          </label>
          <div className="flex gap-2">
            <input
              value={phone} onChange={e => setPhone(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && lookup()}
              placeholder="0XX-XXX-XXXX" type="tel"
              className="input flex-1"
            />
            <button onClick={lookup} disabled={loading}
              className="btn-primary px-5 py-2 shrink-0 flex items-center gap-1.5">
              {loading
                ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <ChevronRight size={16} />}
            </button>
          </div>
          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        </div>

        {/* Not found */}
        {data && !data.found && (
          <div className="card p-6 text-center">
            <p className="text-text font-semibold mb-1">
              {lang === 'th' ? 'ยังไม่มีข้อมูลในระบบ' : 'No record found'}
            </p>
            <p className="text-muted text-sm">
              {lang === 'th'
                ? 'สั่งอาหารหรือจองโต๊ะก่อน แล้วแต้มจะเริ่มสะสมอัตโนมัติ'
                : 'Place an order or make a reservation to start earning points'}
            </p>
            <Link href={`/r/${slug}/reserve`}
              className="mt-4 inline-flex items-center gap-1.5 btn-primary text-sm px-4 py-2">
              <CalendarClock size={14} />
              {lang === 'th' ? 'จองโต๊ะ' : 'Make a Reservation'}
            </Link>
          </div>
        )}

        {/* Found — profile */}
        {data?.found && (
          <>
            {/* Points card */}
            <div className="card p-6 bg-gradient-to-br from-orange-50 to-rose-50 border-orange-100">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted font-medium">
                    {lang === 'th' ? 'สวัสดี,' : 'Hello,'} {data.customer.name}
                  </p>
                  <p className="font-display font-bold text-4xl text-orange-500 mt-1">
                    {data.customer.total_points.toLocaleString()}
                  </p>
                  <p className="text-xs text-orange-400 font-medium mt-0.5">
                    {lang === 'th' ? 'แต้มสะสม' : 'Reward Points'}
                  </p>
                </div>
                <div className="text-right">
                  <div className="w-14 h-14 rounded-2xl bg-orange-100 flex items-center justify-center">
                    <Star size={28} className="text-orange-400" />
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-orange-100 grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <p className="font-bold text-orange-500">{data.meta.pointsPerBaht * 10}</p>
                  <p className="text-muted">{lang === 'th' ? 'แต้มต่อ ฿10' : 'pts per ฿10'}</p>
                </div>
                <div>
                  <p className="font-bold text-orange-500">{data.meta.pointsPerReservation}</p>
                  <p className="text-muted">{lang === 'th' ? 'แต้มต่อการจอง' : 'pts/booking'}</p>
                </div>
                <div>
                  <p className="font-bold text-orange-500">
                    {data.customer.total_points >= data.meta.minRedeem
                      ? `฿${redeemableDiscount}`
                      : `${data.meta.minRedeem - data.customer.total_points} pts`}
                  </p>
                  <p className="text-muted">
                    {data.customer.total_points >= data.meta.minRedeem
                      ? (lang === 'th' ? 'ใช้ได้เลย' : 'redeemable')
                      : (lang === 'th' ? 'จนครบขั้นต่ำ' : 'to min redeem')}
                  </p>
                </div>
              </div>
            </div>

            {/* Reservations */}
            {data.reservations?.length > 0 && (
              <div>
                <p className="text-sm font-bold text-text px-1 mb-2">
                  {lang === 'th' ? '📅 การจองล่าสุด' : '📅 Recent Reservations'}
                </p>
                <div className="space-y-2">
                  {data.reservations.map((r: any) => {
                    const s = RES_STATUS[r.status] ?? RES_STATUS.confirmed
                    return (
                      <div key={r.id} className="card p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm text-text">
                                {lang === 'th' ? 'โต๊ะ' : 'Table'} {r.table_label}
                              </span>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.color}`}>
                                {lang === 'th' ? s.th : s.label}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted mt-1">
                              <span className="flex items-center gap-1"><Clock size={10} />{formatDate(r.reserved_at)} {formatTime(r.reserved_at)}</span>
                              <span className="flex items-center gap-1"><Users size={10} />{r.party_size} {lang === 'th' ? 'คน' : 'pax'}</span>
                            </div>
                            {r.pre_order_items?.length > 0 && (
                              <div className="mt-1.5">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                  r.pre_order_payment === 'paid' ? 'bg-green-50 text-green-600' :
                                  r.pre_order_payment === 'rejected' ? 'bg-red-50 text-red-500' :
                                  'bg-amber-50 text-amber-600'
                                }`}>
                                  {lang === 'th' ? 'สั่งล่วงหน้า' : 'Pre-order'} ฿{r.pre_order_total?.toFixed(0)}
                                  {r.pre_order_payment === 'paid' ? ' ✓' : r.pre_order_payment === 'rejected' ? ' ✗' : ' ⏳'}
                                </span>
                              </div>
                            )}
                          </div>
                          {r.status === 'seated' && (
                            <CheckCircle size={16} className="text-green-500 shrink-0 mt-0.5" />
                          )}
                          {(r.status === 'cancelled' || r.status === 'no_show') && (
                            <XCircle size={16} className="text-gray-300 shrink-0 mt-0.5" />
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Point transactions */}
            {data.transactions?.length > 0 && (
              <div>
                <p className="text-sm font-bold text-text px-1 mb-2">
                  {lang === 'th' ? '⭐ ประวัติแต้ม' : '⭐ Points History'}
                </p>
                <div className="card divide-y divide-border">
                  {data.transactions.map((tx: any) => (
                    <div key={tx.id} className="flex items-center gap-3 px-4 py-3">
                      {tx.type === 'earn'
                        ? <ArrowUpCircle size={18} className="text-green-500 shrink-0" />
                        : <ArrowDownCircle size={18} className="text-orange-400 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-text font-medium truncate">
                          {tx.note ?? (tx.source === 'order'
                            ? (lang === 'th' ? 'สั่งอาหาร' : 'Food Order')
                            : (lang === 'th' ? 'จองโต๊ะ' : 'Reservation'))}
                        </p>
                        <p className="text-xs text-muted">
                          {new Date(tx.created_at).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                      <span className={`font-bold text-sm shrink-0 ${tx.type === 'earn' ? 'text-green-600' : 'text-orange-400'}`}>
                        {tx.type === 'earn' ? '+' : ''}{tx.points}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.reservations?.length === 0 && data.transactions?.length === 0 && (
              <div className="card p-6 text-center text-muted text-sm">
                {lang === 'th' ? 'ยังไม่มีประวัติ' : 'No history yet'}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pb-6">
              <Link href={`/r/${slug}/reserve`}
                className="btn-primary flex items-center justify-center gap-1.5 py-3 text-sm">
                <CalendarClock size={15} />
                {lang === 'th' ? 'จองโต๊ะ' : 'Reserve'}
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
