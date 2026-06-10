'use client'
import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { CheckCircle, Calendar, Clock, Users, MapPin, Phone, User, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useI18n, LangToggle } from '@/lib/i18n'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export default function ConfirmPage() {
  const { slug }       = useParams() as { slug: string }
  const searchParams   = useSearchParams()
  const id             = searchParams.get('id')
  const { t, lang, setLang } = useI18n()
  const [res, setRes]  = useState<any>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) { setError(t.bookingNotFound); return }
    fetch(`${API}/reservations/public/booking/${id}`)
      .then(r => r.json())
      .then(data => { if (data.error) setError(data.error); else setRes(data) })
      .catch(() => setError(t.cannotLoad))
  }, [id])

  function formatDateTime(iso: string) {
    const d = new Date(iso)
    return {
      date: d.toLocaleDateString(t.dateLocale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      time: d.toLocaleTimeString(t.dateLocale, { hour: '2-digit', minute: '2-digit' }),
    }
  }

  if (error) return (
    <div className="min-h-screen bg-bg2 flex items-center justify-center px-4">
      <div className="text-center">
        <p className="text-red-500 mb-4">{error}</p>
        <Link href={`/r/${slug}/reserve`} className="text-accent text-sm">{t.backToBook}</Link>
      </div>
    </div>
  )

  if (!res) return (
    <div className="min-h-screen bg-bg2 flex items-center justify-center">
      <div className="text-muted text-sm">{t.loading}</div>
    </div>
  )

  const { date, time } = formatDateTime(res.reserved_at)

  return (
    <div className="min-h-screen bg-bg2 flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-md space-y-4">
        {/* Header */}
        <div className="text-center mb-4 relative">
          <div className="absolute right-0 top-0">
            <LangToggle lang={lang} setLang={setLang} />
          </div>
          <div className="size-16 rounded-full bg-green/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-green" />
          </div>
          <h1 className="font-display font-bold text-2xl text-text">{t.bookingConfirmed}</h1>
          <p className="text-muted text-sm mt-1">{t.showOnArrival}</p>
        </div>

        {/* Booking details */}
        <div className="card p-6 space-y-4">
          <div className="pb-4 border-b border-border">
            <p className="text-xs text-muted mb-1">{t.bookingNumber}</p>
            <p className="font-mono text-sm font-bold text-accent">{res.id.slice(0, 8).toUpperCase()}</p>
          </div>
          {[
            { icon: Calendar, label: t.labelDate,   value: date },
            { icon: Clock,    label: t.labelTime,   value: time },
            { icon: MapPin,   label: t.labelTable,  value: `${res.table_label} (${res.table_seats} ${t.seats})` },
            { icon: Users,    label: t.labelGuests, value: t.persons(res.party_size) },
            { icon: User,     label: t.labelName,   value: res.customer_name },
            { icon: Phone,    label: t.labelPhone,  value: res.customer_phone },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-start gap-3">
              <div className="size-8 rounded-lg bg-bg3 flex items-center justify-center shrink-0">
                <Icon size={15} className="text-muted" />
              </div>
              <div>
                <p className="text-xs text-muted">{label}</p>
                <p className="text-sm font-medium text-text">{value}</p>
              </div>
            </div>
          ))}
          {res.notes && (
            <div className="pt-3 border-t border-border">
              <p className="text-xs text-muted mb-1">{t.notesLabel}</p>
              <p className="text-sm text-text">{res.notes}</p>
            </div>
          )}
        </div>

        {/* Pre-order items */}
        {res.pre_order_items?.length > 0 && (
          <div className="card p-6 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-text">{t.preOrderItems}</p>
              <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                res.pre_order_payment === 'paid'     ? 'bg-green-50 text-green-600' :
                res.pre_order_payment === 'rejected' ? 'bg-red-50 text-red-500' :
                'bg-amber-50 text-amber-600'
              }`}>
                {res.pre_order_payment === 'paid'     ? t.preOrderPaid :
                 res.pre_order_payment === 'rejected' ? t.preOrderRejected :
                 t.preOrderPending}
              </span>
            </div>
            <div className="space-y-2">
              {res.pre_order_items.map((item: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <span className="text-text">{item.menu_name} <span className="text-muted">×{item.quantity}</span></span>
                  <span className="font-bold text-orange-500">฿{(item.unit_price * item.quantity).toFixed(0)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-border pt-2 flex justify-between font-bold text-sm">
              <span className="text-muted">{t.preOrderTotal}</span>
              <span className="text-orange-500">฿{res.pre_order_total?.toFixed(0)}</span>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-muted">{t.cancelInstruction}</p>
        <div className="text-center">
          <Link href={`/r/${slug}/reserve`} className="text-accent text-sm flex items-center justify-center gap-1">
            <ArrowLeft size={14} />{t.bookAnother}
          </Link>
        </div>
      </div>
    </div>
  )
}
