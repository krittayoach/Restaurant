'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { api, getToken } from '@/lib/api'
import {
  CalendarClock, ChevronLeft, ChevronRight, Users, Phone,
  FileText, ExternalLink, X,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { useToast } from '@/components/Toast'
import { Spinner } from '@/components/Spinner'
import { useDashboardLang } from '@/lib/i18n-dashboard'

type Reservation = {
  id: string
  customer_name: string
  customer_phone: string
  party_size: number
  reserved_at: string
  notes: string | null
  status: 'confirmed' | 'seated' | 'cancelled' | 'no_show'
  table_label: string
  table_id: string
  pre_order_items: { menu_name: string; quantity: number; unit_price: number; note?: string }[] | null
  pre_order_total: number
  pre_order_payment: 'none' | 'pending' | 'paid' | 'rejected'
  pre_order_slip: string | null
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}
function isoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

export default function ReservationsPage() {
  const { slug } = useParams() as { slug: string }
  const { t } = useDashboardLang()
  const toast = useToast()

  const [token, setToken] = useState('')
  const [date, setDate] = useState(isoDate(new Date()))
  const [tab, setTab] = useState<'all' | 'pending'>('all')
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [pendingPreorders, setPendingPreorders] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<Record<string, boolean>>({})
  const [viewSlip, setViewSlip] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const rt = t.reservations

  const loadAll = useCallback(async (tok: string, d: string) => {
    setLoading(true)
    try {
      const [res, pending] = await Promise.all([
        api.get(`/reservations?date=${d}`, tok).catch(() => []),
        api.get('/reservations/pending-preorders', tok).catch(() => []),
      ])
      setReservations(res ?? [])
      setPendingPreorders(pending ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const tok = getToken()
    setToken(tok)
    loadAll(tok, date)
  }, [])

  function shiftDate(days: number) {
    const d = new Date(date)
    d.setDate(d.getDate() + days)
    const next = isoDate(d)
    setDate(next)
    loadAll(token, next)
  }

  async function updateStatus(id: string, status: 'seated' | 'no_show' | 'cancelled') {
    setBusyId(b => ({ ...b, [`${id}_${status}`]: true }))
    try {
      await api.patch(`/reservations/${id}`, { status }, token)
      toast.success(status === 'seated' ? 'ลูกค้าเข้านั่งแล้ว' : status === 'cancelled' ? 'ยกเลิกการจองแล้ว' : 'บันทึก no-show แล้ว')
      loadAll(token, date)
    } catch (e: any) {
      toast.error(e.message ?? t.common.error)
    } finally {
      setBusyId(b => ({ ...b, [`${id}_${status}`]: false }))
    }
  }

  async function handlePreOrder(id: string, action: 'approve' | 'reject') {
    setBusyId(b => ({ ...b, [`${id}_${action}`]: true }))
    try {
      await api.patch(`/reservations/${id}/pre-order-payment`, { action }, token)
      toast.success(action === 'approve' ? 'ยืนยันชำระเงินแล้ว' : 'ปฏิเสธการชำระเงินแล้ว')
      loadAll(token, date)
    } catch (e: any) {
      toast.error(e.message ?? t.common.error)
    } finally {
      setBusyId(b => ({ ...b, [`${id}_${action}`]: false }))
    }
  }

  const confirmed = reservations.filter(r => r.status === 'confirmed').length
  const seated = reservations.filter(r => r.status === 'seated').length
  const cancelled = reservations.filter(r => r.status === 'cancelled' || r.status === 'no_show').length

  const displayList = tab === 'all' ? reservations : pendingPreorders

  const RES_STATUS: Record<string, { label: string; cls: string }> = {
    confirmed: { label: rt.confirmed,  cls: 'bg-blue/10 text-blue' },
    seated:    { label: rt.seated,     cls: 'bg-green/10 text-green' },
    cancelled: { label: t.common.cancel, cls: 'bg-rose/10 text-rose' },
    no_show:   { label: rt.noShow,     cls: 'bg-bg3 text-muted' },
  }

  const PRE_ORDER_STATUS: Record<string, { label: string; cls: string }> = {
    pending:  { label: rt.preOrderPending,  cls: 'bg-yellow/10 text-yellow' },
    paid:     { label: rt.preOrderPaid,     cls: 'bg-green/10 text-green' },
    rejected: { label: rt.preOrderRejected, cls: 'bg-rose/10 text-rose' },
  }

  return (
    <div className="p-5 md:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 anim-up">
        <div>
          <h1 className="font-display font-bold text-2xl md:text-3xl text-text text-balance">{rt.title}</h1>
          <p className="text-muted text-sm mt-0.5">{rt.subtitle}</p>
        </div>
        <a href={`/r/${slug}/reserve`} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-accent hover:underline font-medium mt-1">
          <ExternalLink size={13} /> {rt.reserveLink}
        </a>
      </div>

      {/* Date navigation */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => shiftDate(-1)} aria-label="วันก่อนหน้า"
          className="size-9 rounded-xl bg-bg3 hover:bg-border text-muted hover:text-text flex items-center justify-center transition-colors">
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1">
          <input type="date" value={date}
            onChange={e => { setDate(e.target.value); loadAll(token, e.target.value) }}
            className="input w-full text-center font-semibold" />
          <p className="text-xs text-muted text-center mt-1">{formatDate(date + 'T12:00:00')}</p>
        </div>
        <button onClick={() => shiftDate(1)} aria-label="วันถัดไป"
          className="size-9 rounded-xl bg-bg3 hover:bg-border text-muted hover:text-text flex items-center justify-center transition-colors">
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: rt.statsTotal,     value: reservations.length, cls: 'text-text' },
          { label: rt.statsConfirmed, value: confirmed,            cls: 'text-blue' },
          { label: rt.statsSeated,    value: seated,               cls: 'text-green' },
          { label: rt.statsCancelled, value: cancelled,            cls: 'text-rose' },
        ].map(s => (
          <div key={s.label} className="card p-3 text-center">
            <p className={`font-display font-bold text-2xl ${s.cls}`}>{s.value}</p>
            <p className="text-xs text-muted mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-bg3 p-1 rounded-xl w-fit">
        <button onClick={() => setTab('all')}
          className={cn('px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
            tab === 'all' ? 'bg-bg text-text shadow-sm' : 'text-muted hover:text-text')}>
          {rt.tabAll}
          {reservations.length > 0 && (
            <span className="ml-1.5 text-xs bg-accent/15 text-accent px-1.5 py-0.5 rounded-full font-bold">{reservations.length}</span>
          )}
        </button>
        <button onClick={() => setTab('pending')}
          className={cn('px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
            tab === 'pending' ? 'bg-bg text-text shadow-sm' : 'text-muted hover:text-text')}>
          {rt.tabPending}
          {pendingPreorders.length > 0 && (
            <span className="ml-1.5 text-xs bg-yellow/20 text-yellow px-1.5 py-0.5 rounded-full font-bold">{pendingPreorders.length}</span>
          )}
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted gap-2">
          <Spinner size={18} /><span className="text-sm">{t.common.loading}</span>
        </div>
      ) : displayList.length === 0 ? (
        <div className="card p-10 text-center">
          <CalendarClock size={40} className="text-muted/30 mx-auto mb-3" />
          <p className="text-muted text-sm">{tab === 'all' ? rt.noReservations : rt.noPendingPreorders}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayList.map(r => {
            const s = RES_STATUS[r.status] ?? RES_STATUS.confirmed
            const hasPreOrder = r.pre_order_items && r.pre_order_items.length > 0
            const isExpanded = expanded[r.id]
            const anyBusy = Object.keys(busyId).some(k => k.startsWith(r.id) && busyId[k])

            return (
              <div key={r.id} className="card overflow-hidden anim-up">
                <div className="p-4 flex items-center gap-4">
                  {/* Time */}
                  <div className="text-center w-14 shrink-0">
                    <p className="font-display font-bold text-xl text-text">{formatTime(r.reserved_at)}</p>
                    <p className="text-xs text-muted">น.</p>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-text">{r.customer_name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.cls}`}>{s.label}</span>
                      {hasPreOrder && r.pre_order_payment !== 'none' && PRE_ORDER_STATUS[r.pre_order_payment] && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRE_ORDER_STATUS[r.pre_order_payment].cls}`}>
                          {rt.preOrderItems} · {PRE_ORDER_STATUS[r.pre_order_payment].label}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted mt-0.5 flex-wrap">
                      <span className="flex items-center gap-1"><Users size={11} />{r.party_size} {t.common.persons}</span>
                      <span className="flex items-center gap-1"><Phone size={11} />{r.customer_phone}</span>
                      <span>{t.common.table} {r.table_label}</span>
                    </div>
                    {r.notes && <p className="text-xs text-muted mt-1 italic">"{r.notes}"</p>}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-1.5 shrink-0 items-end">
                    {r.status === 'confirmed' && (
                      <div className="flex gap-1.5 flex-wrap justify-end">
                        {(['seated', 'no_show', 'cancelled'] as const).map(status => {
                          const busy = busyId[`${r.id}_${status}`]
                          const cfg = {
                            seated:    { label: rt.seated,        cls: 'bg-green/10 text-green hover:bg-green/20' },
                            no_show:   { label: rt.noShow,        cls: 'bg-bg3 text-muted hover:bg-border' },
                            cancelled: { label: t.common.cancel,  cls: 'bg-rose/10 text-rose hover:bg-rose/20' },
                          }[status]
                          return (
                            <button key={status} onClick={() => updateStatus(r.id, status)}
                              disabled={anyBusy}
                              className={`text-xs px-2.5 py-1.5 rounded-lg font-medium flex items-center gap-1 disabled:opacity-50 transition-colors ${cfg.cls}`}>
                              {busy ? <Spinner size={11} /> : null}{cfg.label}
                            </button>
                          )
                        })}
                      </div>
                    )}

                    {r.pre_order_payment === 'pending' && r.pre_order_slip && (
                      <div className="flex gap-1.5 flex-wrap justify-end">
                        <button onClick={() => setViewSlip(r.pre_order_slip!)}
                          className="text-xs px-2 py-1.5 rounded-lg bg-blue/10 text-blue hover:bg-blue/20 font-medium flex items-center gap-1">
                          <FileText size={11} /> {rt.viewSlip}
                        </button>
                        <button onClick={() => handlePreOrder(r.id, 'approve')} disabled={anyBusy}
                          className="text-xs px-2 py-1.5 rounded-lg bg-green/10 text-green hover:bg-green/20 font-medium flex items-center gap-1 disabled:opacity-50">
                          {busyId[`${r.id}_approve`] ? <Spinner size={11} /> : null}
                          {t.common.approve} ฿{r.pre_order_total?.toFixed(0)}
                        </button>
                        <button onClick={() => handlePreOrder(r.id, 'reject')} disabled={anyBusy}
                          className="text-xs px-2 py-1.5 rounded-lg bg-rose/10 text-rose hover:bg-rose/20 font-medium flex items-center gap-1 disabled:opacity-50">
                          {busyId[`${r.id}_reject`] ? <Spinner size={11} /> : null}
                          {t.common.reject}
                        </button>
                      </div>
                    )}

                    {r.pre_order_payment === 'paid' && (
                      <span className="text-xs text-green font-semibold">{rt.paidAdvance} ฿{r.pre_order_total?.toFixed(0)}</span>
                    )}
                    {r.pre_order_payment === 'rejected' && (
                      <span className="text-xs text-rose font-medium">{rt.payFailed}</span>
                    )}

                    {hasPreOrder && (
                      <button onClick={() => setExpanded(e => ({ ...e, [r.id]: !e[r.id] }))}
                        className="text-xs text-accent hover:underline font-medium">
                        {isExpanded ? '▲' : '▼'} {rt.preOrderItems} ({r.pre_order_items!.length} {t.common.items})
                      </button>
                    )}
                  </div>
                </div>

                {/* Pre-order items expanded */}
                {hasPreOrder && isExpanded && (
                  <div className="border-t border-border bg-bg3 px-4 py-3">
                    <div className="space-y-1.5">
                      {r.pre_order_items!.map((item, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <div>
                            <span className="text-text font-medium">{item.menu_name}</span>
                            {item.note && <span className="text-muted text-xs ml-2">({item.note})</span>}
                          </div>
                          <div className="text-muted text-xs flex items-center gap-3">
                            <span>×{item.quantity}</span>
                            <span className="text-text font-semibold">฿{(item.unit_price * item.quantity).toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                      <div className="border-t border-border pt-2 flex justify-between text-sm font-bold text-text">
                        <span>รวม</span>
                        <span>฿{r.pre_order_total?.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Slip modal */}
      {viewSlip && (
        <div className="fixed inset-0 z-modal bg-black/60 flex items-center justify-center p-4"
          onClick={() => setViewSlip(null)}>
          <div className="bg-bg rounded-2xl p-4 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold text-text">สลิป Pre-order</p>
              <button onClick={() => setViewSlip(null)} aria-label={t.common.close}
                className="size-8 flex items-center justify-center rounded-xl bg-bg3 text-muted hover:text-text transition-colors">
                <X size={16} />
              </button>
            </div>
            <img src={viewSlip} alt="slip" className="w-full rounded-xl object-contain max-h-[70vh]" />
          </div>
        </div>
      )}
    </div>
  )
}
