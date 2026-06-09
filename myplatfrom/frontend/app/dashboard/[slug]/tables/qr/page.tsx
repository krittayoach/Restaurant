'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { api, getToken } from '@/lib/api'
import QRCode from 'qrcode'
import { QrCode, RefreshCw, ExternalLink, RotateCcw, Download, Plus, Pencil, Trash2, X, Check, CalendarClock, Users, Phone } from 'lucide-react'
import { useConfirm } from '@/components/ConfirmModal'
import { useToast } from '@/components/Toast'
import { Spinner } from '@/components/Spinner'

const RES_STATUS: Record<string, { label: string; color: string }> = {
  confirmed: { label: 'ยืนยันแล้ว', color: 'text-accent bg-accent/10' },
  seated:    { label: 'เข้านั่งแล้ว', color: 'text-green bg-green/10' },
  cancelled: { label: 'ยกเลิก',      color: 'text-muted bg-bg3' },
  no_show:   { label: 'ไม่มา',       color: 'text-rose bg-rose/10' },
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
}

const STATUS: Record<string, { emoji: string; text: string }> = {
  available: { emoji: '🟢', text: 'text-green' },
  occupied:  { emoji: '🍽️', text: 'text-accent' },
  reserved:  { emoji: '📌', text: 'text-violet' },
  cleaning:  { emoji: '🧹', text: 'text-yellow' },
}

export default function QRPage() {
  const params = useParams() as { slug: string }
  const [tables, setTables] = useState<any[]>([])
  const [qrImages, setQrImages] = useState<Record<string, string>>({})
  const [token, setToken] = useState('')
  const { confirm } = useConfirm()
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [addSaving, setAddSaving] = useState(false)
  const [busyId, setBusyId] = useState<Record<string, boolean>>({})
  const [resBusyId, setResBusyId] = useState<Record<string, boolean>>({})
  const [addForm, setAddForm] = useState({ label: '', seats: '4' })
  const [addSubmitted, setAddSubmitted] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ label: '', seats: '' })
  const [reservations, setReservations] = useState<any[]>([])
  const [resDate, setResDate] = useState(new Date().toISOString().slice(0, 10))

  useEffect(() => {
    const t = getToken()
    setToken(t); load(t); loadReservations(t, resDate)
  }, [])

  async function loadReservations(t: string, date: string) {
    const data = await api.get(`/reservations?date=${date}`, t).catch(() => [])
    setReservations(data ?? [])
  }

  async function updateResStatus(id: string, status: string) {
    setResBusyId(b => ({ ...b, [`${id}_${status}`]: true }))
    try {
      await api.patch(`/reservations/${id}`, { status }, token)
      loadReservations(token, resDate)
      load(token)
    } catch (e: any) { toast.error(e.message ?? 'เกิดข้อผิดพลาด') }
    finally { setResBusyId(b => ({ ...b, [`${id}_${status}`]: false })) }
  }

  async function approvePreOrder(id: string, action: 'approve' | 'reject') {
    setResBusyId(b => ({ ...b, [`${id}_${action}`]: true }))
    try {
      await api.patch(`/reservations/${id}/pre-order-payment`, { action }, token)
      loadReservations(token, resDate)
      toast.success(action === 'approve' ? 'ยืนยันชำระเงินแล้ว' : 'ปฏิเสธการชำระเงินแล้ว')
    } catch (e: any) { toast.error(e.message ?? 'เกิดข้อผิดพลาด') }
    finally { setResBusyId(b => ({ ...b, [`${id}_${action}`]: false })) }
  }

  const [viewSlip, setViewSlip] = useState<string | null>(null)

  async function load(t: string) {
    const tbls = await api.get('/tables', t).catch(() => [])
    setTables(tbls)
    const imgs: Record<string, string> = {}
    for (const table of tbls) {
      if (table.qr_token) {
        const url = `${window.location.origin}/r/${params.slug}/table/${table.qr_token}`
        imgs[table.id] = await QRCode.toDataURL(url, { width: 200, margin: 2, color: { dark: '#2b1c10', light: '#ffffff' } })
      }
    }
    setQrImages(imgs)
  }

  async function addTable(e: React.FormEvent) {
    e.preventDefault()
    setAddSubmitted(true)
    if (!addForm.label) return
    setAddSaving(true)
    try {
      await api.post('/tables', { label: addForm.label, seats: parseInt(addForm.seats) || 4 }, token)
      setAddForm({ label: '', seats: '4' }); setAddSubmitted(false); setShowAdd(false); load(token)
    } catch (e: any) { toast.error(e.message ?? 'เพิ่มโต๊ะไม่สำเร็จ') }
    finally { setAddSaving(false) }
  }

  async function saveEdit(id: string) {
    if (!editForm.label) return
    setBusyId(b => ({ ...b, [`edit_${id}`]: true }))
    try { await api.patch(`/tables/${id}`, { label: editForm.label, seats: parseInt(editForm.seats) || 4 }, token); setEditingId(null); load(token) }
    catch (e: any) { toast.error(e.message ?? 'แก้ไขไม่สำเร็จ') }
    finally { setBusyId(b => ({ ...b, [`edit_${id}`]: false })) }
  }

  async function deleteTable(id: string, label: string) {
    if (!await confirm({ title: `ลบโต๊ะ ${label}?`, danger: true, confirmLabel: 'ลบ' })) return
    setBusyId(b => ({ ...b, [`del_${id}`]: true }))
    try { await api.delete(`/tables/${id}`, token); load(token) }
    catch (e: any) { toast.error(e.message ?? 'ลบไม่สำเร็จ') }
    finally { setBusyId(b => ({ ...b, [`del_${id}`]: false })) }
  }

  async function resetQR(id: string) {
    setBusyId(b => ({ ...b, [`qr_${id}`]: true }))
    try { await api.patch(`/tables/${id}/qr-token`, {}, token); load(token) }
    catch (e: any) { toast.error(e.message ?? 'เกิดข้อผิดพลาด') }
    finally { setBusyId(b => ({ ...b, [`qr_${id}`]: false })) }
  }
  async function resetAll() {
    if (!await confirm({ title: 'รีเซ็ต QR ทุกโต๊ะ?', message: 'QR เก่าจะใช้ไม่ได้ทันที', confirmLabel: 'รีเซ็ต' })) return
    setLoading(true)
    try { await api.post('/tables/qr-token/bulk', {}, token); await load(token) }
    catch (e: any) { toast.error(e.message ?? 'เกิดข้อผิดพลาด') }
    finally { setLoading(false) }
  }
  function downloadQR(table: any) {
    const img = qrImages[table.id]; if (!img) return
    const a = document.createElement('a'); a.href = img; a.download = `QR-${table.label}.png`; a.click()
  }

  return (
    <div className="p-5 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6 anim-up">
        <div>
          <h1 className="font-display font-bold text-2xl md:text-3xl text-text">📱 QR Code โต๊ะ</h1>
          <p className="text-muted text-sm mt-0.5">{tables.length} โต๊ะ · ลูกค้าสแกนเพื่อสั่ง</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setShowAdd(v => !v); setAddSubmitted(false) }} className="btn-primary"><Plus size={15} /> เพิ่มโต๊ะ</button>
          <button onClick={resetAll} disabled={loading} className="btn-danger">
            <RotateCcw size={14} className={loading ? 'animate-spin' : ''} /> รีเซ็ต QR
          </button>
        </div>
      </div>

      {/* Add table form */}
      {showAdd && (
        <div className="card p-5 mb-6 anim-pop">
          <div className="flex items-center justify-between mb-4">
            <p className="font-display font-semibold text-base">เพิ่มโต๊ะใหม่</p>
            <button onClick={() => { setShowAdd(false); setAddSubmitted(false) }} className="text-muted hover:text-text"><X size={18} /></button>
          </div>
          <form onSubmit={addTable} className="flex gap-3 flex-wrap items-end">
            <div className="flex-1 min-w-[120px]">
              <label className="block text-xs text-muted mb-1.5">ชื่อโต๊ะ <span className="text-rose">*</span></label>
              <input value={addForm.label} onChange={e => setAddForm(f => ({ ...f, label: e.target.value }))}
                placeholder="T11" className={`input ${addSubmitted && !addForm.label ? 'input-error' : ''}`} autoFocus />
            </div>
            <div className="w-28">
              <label className="block text-xs text-muted mb-1.5">ที่นั่ง</label>
              <input type="number" value={addForm.seats} onChange={e => setAddForm(f => ({ ...f, seats: e.target.value }))}
                placeholder="4" min="1" className="input" />
            </div>
            <div className="flex gap-2 items-end">
              <button type="submit" disabled={addSaving} className="btn-primary gap-2 disabled:opacity-70">
                {addSaving ? <><Spinner size={14} />กำลังเพิ่ม...</> : 'เพิ่มโต๊ะ'}
              </button>
              <button type="button" onClick={() => { setShowAdd(false); setAddSubmitted(false) }} disabled={addSaving} className="btn-secondary">ยกเลิก</button>
            </div>
          </form>
        </div>
      )}

      {/* Reservations section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CalendarClock size={18} className="text-accent" />
            <h2 className="font-display font-bold text-lg text-text">การจองโต๊ะ</h2>
          </div>
          <div className="flex items-center gap-2">
            <a href={`/r/${params.slug}/reserve`} target="_blank"
              className="text-xs text-accent hover:underline">ลิงก์จองสำหรับลูกค้า ↗</a>
            <input type="date" value={resDate}
              onChange={e => { setResDate(e.target.value); loadReservations(token, e.target.value) }}
              className="input py-1.5 text-sm" />
          </div>
        </div>
        {reservations.length === 0 ? (
          <div className="card p-6 text-center text-muted text-sm">ไม่มีการจองในวันนี้</div>
        ) : (
          <div className="space-y-2">
            {reservations.map(r => {
              const s = RES_STATUS[r.status] ?? RES_STATUS.confirmed
              return (
                <div key={r.id} className="card p-4 flex items-center gap-4">
                  <div className="text-center w-14 shrink-0">
                    <p className="font-bold text-lg text-text">{formatTime(r.reserved_at)}</p>
                    <p className="text-xs text-muted">น.</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-text">{r.customer_name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.color}`}>{s.label}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted mt-0.5 flex-wrap">
                      <span className="flex items-center gap-1"><Users size={10} />{r.party_size} คน</span>
                      <span className="flex items-center gap-1"><Phone size={10} />{r.customer_phone}</span>
                      <span>โต๊ะ {r.table_label}</span>
                    </div>
                    {r.notes && <p className="text-xs text-muted mt-1 italic">"{r.notes}"</p>}
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0 items-end">
                    {r.status === 'confirmed' && (
                      <div className="flex gap-1.5">
                        {(['seated', 'no_show', 'cancelled'] as const).map(status => {
                          const busy = resBusyId[`${r.id}_${status}`]
                          const anyBusy = Object.keys(resBusyId).some(k => k.startsWith(r.id) && resBusyId[k])
                          const cfg = {
                            seated:    { label: 'เข้านั่ง', cls: 'bg-green/10 text-green hover:bg-green/20' },
                            no_show:   { label: 'ไม่มา',    cls: 'bg-bg3 text-muted hover:bg-border' },
                            cancelled: { label: 'ยกเลิก',   cls: 'bg-rose/10 text-rose hover:bg-rose/20' },
                          }[status]
                          return (
                            <button key={status} onClick={() => updateResStatus(r.id, status)}
                              disabled={anyBusy}
                              className={`text-xs px-2.5 py-1.5 rounded-lg font-medium flex items-center gap-1 disabled:opacity-50 ${cfg.cls}`}>
                              {busy ? <Spinner size={11} /> : null}{cfg.label}
                            </button>
                          )
                        })}
                      </div>
                    )}
                    {r.pre_order_payment === 'pending' && r.pre_order_slip && (
                      <div className="flex gap-1.5">
                        <button onClick={() => setViewSlip(r.pre_order_slip)}
                          className="text-xs px-2 py-1 rounded-lg bg-blue/10 text-blue hover:bg-blue/20 font-medium">
                          ดูสลิป
                        </button>
                        <button onClick={() => approvePreOrder(r.id, 'approve')}
                          disabled={resBusyId[`${r.id}_approve`] || resBusyId[`${r.id}_reject`]}
                          className="text-xs px-2 py-1 rounded-lg bg-green/10 text-green hover:bg-green/20 font-medium flex items-center gap-1 disabled:opacity-50">
                          {resBusyId[`${r.id}_approve`] ? <Spinner size={11} /> : null}อนุมัติ ฿{r.pre_order_total?.toFixed(0)}
                        </button>
                        <button onClick={() => approvePreOrder(r.id, 'reject')}
                          className="text-xs px-2 py-1 rounded-lg bg-rose/10 text-rose hover:bg-rose/20 font-medium">
                          {resBusyId[`${r.id}_reject`] ? <Spinner size={11} /> : null}ปฏิเสธ
                        </button>
                      </div>
                    )}
                    {r.pre_order_payment === 'paid' && (
                      <span className="text-xs text-green font-semibold">✓ ชำระล่วงหน้าแล้ว ฿{r.pre_order_total?.toFixed(0)}</span>
                    )}
                    {r.pre_order_payment === 'rejected' && (
                      <span className="text-xs text-rose font-medium">✗ ไม่ผ่านการชำระ</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {tables.map((table, i) => {
          const s = STATUS[table.status] ?? { emoji: '⚪', text: 'text-muted' }
          const qrImg = qrImages[table.id]
          const isEditing = editingId === table.id
          return (
            <div key={table.id} className={`card card-hover p-4 flex flex-col anim-up ${isEditing ? 'ring-2 ring-accent/40' : ''}`} style={{ animationDelay: `${i * 30}ms` }}>
              {/* Header */}
              {isEditing ? (
                <div className="mb-3 space-y-2">
                  <input value={editForm.label} onChange={e => setEditForm(f => ({ ...f, label: e.target.value }))}
                    placeholder="ชื่อโต๊ะ" className="input text-sm py-1.5" autoFocus />
                  <div className="flex gap-1.5">
                    <input type="number" value={editForm.seats} onChange={e => setEditForm(f => ({ ...f, seats: e.target.value }))}
                      placeholder="ที่นั่ง" className="input text-sm py-1.5 w-20" />
                    <button onClick={() => saveEdit(table.id)} disabled={busyId[`edit_${table.id}`]}
                      className="flex-1 flex items-center justify-center gap-1 bg-green/10 text-green rounded-xl py-1.5 text-xs font-semibold hover:bg-green/20 disabled:opacity-50">
                      {busyId[`edit_${table.id}`] ? <Spinner size={12} /> : <Check size={13} />} บันทึก
                    </button>
                    <button onClick={() => setEditingId(null)} disabled={busyId[`edit_${table.id}`]} data-tooltip="ยกเลิก" className="w-8 flex items-center justify-center bg-bg3 text-muted rounded-xl hover:bg-border">
                      <X size={13} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-display font-bold text-2xl">{table.label}</p>
                    <p className="text-xs text-muted">🪑 {table.seats} ที่นั่ง</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xl">{s.emoji}</span>
                    <div className="flex gap-1">
                      <button onClick={() => { setEditingId(table.id); setEditForm({ label: table.label, seats: String(table.seats) }) }}
                        data-tooltip="แก้ไขโต๊ะ" className="w-6 h-6 rounded-lg bg-blue/10 text-blue flex items-center justify-center hover:bg-blue/20">
                        <Pencil size={11} />
                      </button>
                      <button onClick={() => deleteTable(table.id, table.label)} disabled={busyId[`del_${table.id}`]}
                        data-tooltip="ลบโต๊ะ" className="w-6 h-6 rounded-lg bg-rose/10 text-rose flex items-center justify-center hover:bg-rose/20 disabled:opacity-50">
                        {busyId[`del_${table.id}`] ? <Spinner size={10} /> : <Trash2 size={11} />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* QR image */}
              {!isEditing && (qrImg ? (
                <div className="flex flex-col items-center mb-3">
                  <div className="bg-white rounded-2xl p-2 border border-border shadow-sm">
                    <img src={qrImg} alt={`QR ${table.label}`} className="w-32 h-32 rounded-lg" />
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-36 bg-bg3 rounded-2xl mb-3">
                  <QrCode size={32} className="text-muted/40" />
                </div>
              ))}

              {/* Actions */}
              {!isEditing && (table.qr_token ? (
                <div className="grid grid-cols-3 gap-1.5 mt-auto">
                  <a href={`/r/${params.slug}/table/${table.qr_token}`} target="_blank"
                    className="inline-flex items-center justify-center gap-1 bg-teal/10 text-teal rounded-xl py-2 text-xs font-semibold hover:bg-teal/20 transition-colors">
                    <ExternalLink size={11} /> เปิด
                  </a>
                  <button onClick={() => downloadQR(table)}
                    className="inline-flex items-center justify-center gap-1 bg-violet/10 text-violet rounded-xl py-2 text-xs font-semibold hover:bg-violet/20 transition-colors">
                    <Download size={11} /> บันทึก
                  </button>
                  <button onClick={() => resetQR(table.id)} disabled={busyId[`qr_${table.id}`]}
                    className="inline-flex items-center justify-center gap-1 bg-accent/10 text-accent rounded-xl py-2 text-xs font-semibold hover:bg-accent/20 transition-colors disabled:opacity-50">
                    {busyId[`qr_${table.id}`] ? <Spinner size={11} /> : <RefreshCw size={11} />} รีเซ็ต
                  </button>
                </div>
              ) : (
                <button onClick={() => resetQR(table.id)} disabled={busyId[`qr_${table.id}`]} className="btn-primary w-full mt-auto gap-2 disabled:opacity-70">
                  {busyId[`qr_${table.id}`] ? <Spinner size={14} /> : <QrCode size={14} />} สร้าง QR
                </button>
              ))}
            </div>
          )
        })}
      </div>

      {/* Slip preview modal */}
      {viewSlip && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setViewSlip(null)}>
          <div className="bg-white rounded-2xl p-4 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold text-text">สลิปโอนเงิน</p>
              <button onClick={() => setViewSlip(null)} className="text-muted hover:text-text text-xl leading-none">×</button>
            </div>
            <img src={viewSlip} alt="slip" className="w-full rounded-xl object-contain max-h-96" />
          </div>
        </div>
      )}
    </div>
  )
}
