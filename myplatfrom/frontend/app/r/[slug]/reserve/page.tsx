'use client'
import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Calendar, Clock, Users, MapPin, User, Phone, FileText, ChevronRight, CheckCircle } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

function toLocalDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

export default function ReservePage() {
  const { slug } = useParams() as { slug: string }
  const router   = useRouter()

  const today = toLocalDate(new Date())

  const [step, setStep] = useState<'search' | 'form'>('search')
  const [date, setDate]           = useState(today)
  const [time, setTime]           = useState('19:00')
  const [partySize, setPartySize] = useState('2')
  const [tables, setTables]       = useState<any[]>([])
  const [selectedTable, setSelectedTable] = useState<any>(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError]     = useState('')

  const [name, setName]   = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError]   = useState('')
  const [submitted, setSubmitted]   = useState(false)

  async function searchTables() {
    setSearching(true)
    setSearchError('')
    setTables([])
    setSelectedTable(null)
    try {
      const res = await fetch(`${API}/reservations/public/${slug}/tables?date=${date}&time=${time}&party_size=${partySize}`)
      const data = await res.json()
      if (!res.ok) { setSearchError(data.error ?? 'เกิดข้อผิดพลาด'); return }
      setTables(data)
      if (data.length > 0) setStep('form')
      else setSearchError('ไม่มีโต๊ะว่างในช่วงเวลานี้ กรุณาเลือกเวลาอื่น')
    } catch {
      setSearchError('ไม่สามารถเชื่อมต่อได้')
    } finally {
      setSearching(false)
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedTable) { setFormError('กรุณาเลือกโต๊ะ'); return }
    if (!name.trim()) { setFormError('กรุณากรอกชื่อ'); return }
    if (phone.replace(/\D/g, '').length < 9) { setFormError('กรุณากรอกเบอร์โทรให้ครบ'); return }

    setSubmitting(true)
    setFormError('')
    try {
      const res = await fetch(`${API}/reservations/public/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_id:       selectedTable.id,
          customer_name:  name.trim(),
          customer_phone: phone.trim(),
          party_size:     parseInt(partySize),
          date,
          time,
          notes: notes.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setFormError(data.error ?? 'เกิดข้อผิดพลาด'); return }
      router.push(`/r/${slug}/reserve/confirm?id=${data.id}`)
    } catch {
      setFormError('ไม่สามารถจองได้ กรุณาลองใหม่')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg2 flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-display font-bold text-3xl text-text">จองโต๊ะ</h1>
          <p className="text-muted text-sm mt-1">เลือกวันเวลาและโต๊ะที่ต้องการ</p>
        </div>

        {/* Step 1: Search */}
        <div className="card p-6 mb-4">
          <p className="text-sm font-semibold text-text mb-4">1. เลือกวันและเวลา</p>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted mb-1.5 flex items-center gap-1.5"><Calendar size={12} />วันที่</label>
              <input type="date" value={date} min={today}
                onChange={e => setDate(e.target.value)}
                className="input w-full" />
            </div>
            <div>
              <label className="text-xs text-muted mb-1.5 flex items-center gap-1.5"><Clock size={12} />เวลา</label>
              <input type="time" value={time}
                onChange={e => setTime(e.target.value)}
                className="input w-full" />
            </div>
            <div>
              <label className="text-xs text-muted mb-1.5 flex items-center gap-1.5"><Users size={12} />จำนวนคน</label>
              <select value={partySize} onChange={e => setPartySize(e.target.value)} className="input w-full">
                {[1,2,3,4,5,6,7,8,9,10].map(n => (
                  <option key={n} value={n}>{n} คน</option>
                ))}
              </select>
            </div>
            {searchError && <p className="text-red-500 text-sm">{searchError}</p>}
            <button onClick={searchTables} disabled={searching}
              className="btn-primary w-full py-2.5 flex items-center justify-center gap-2">
              {searching ? 'กำลังค้นหา...' : <><span>ค้นหาโต๊ะว่าง</span><ChevronRight size={16} /></>}
            </button>
          </div>
        </div>

        {/* Step 2: Select table + form */}
        {step === 'form' && tables.length > 0 && (
          <form onSubmit={submit} className="space-y-4">
            <div className="card p-6">
              <p className="text-sm font-semibold text-text mb-3">2. เลือกโต๊ะ</p>
              <div className="grid grid-cols-2 gap-2">
                {tables.map(t => (
                  <button key={t.id} type="button"
                    onClick={() => setSelectedTable(t)}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${selectedTable?.id === t.id ? 'border-accent bg-accent/10' : 'border-border bg-bg3 hover:border-accent/50'}`}>
                    <p className="font-bold text-text">{t.label}</p>
                    <p className="text-xs text-muted flex items-center gap-1 mt-0.5"><Users size={10} />{t.seats} ที่นั่ง</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="card p-6">
              <p className="text-sm font-semibold text-text mb-4">3. ข้อมูลผู้จอง</p>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted mb-1.5 flex items-center gap-1.5"><User size={12} />ชื่อ-นามสกุล *</label>
                  <input value={name} onChange={e => setName(e.target.value)}
                    placeholder="สมชาย ใจดี" className="input w-full" required />
                </div>
                <div>
                  <label className="text-xs text-muted mb-1.5 flex items-center gap-1.5"><Phone size={12} />เบอร์โทร *</label>
                  <input value={phone} onChange={e => setPhone(e.target.value)}
                    placeholder="081-234-5678" type="tel" className="input w-full" required />
                </div>
                <div>
                  <label className="text-xs text-muted mb-1.5 flex items-center gap-1.5"><FileText size={12} />หมายเหตุ (ถ้ามี)</label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)}
                    placeholder="เช่น แพ้อาหาร, ต้องการเก้าอี้เด็ก..."
                    rows={2} className="input w-full resize-none" />
                </div>
                {formError && <p className="text-red-500 text-sm">{formError}</p>}
                <button type="submit" disabled={submitting || !selectedTable}
                  className="btn-primary w-full py-2.5 disabled:opacity-50">
                  {submitting ? 'กำลังจอง...' : 'ยืนยันการจอง'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
