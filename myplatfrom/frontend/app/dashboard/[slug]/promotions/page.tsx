'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { api, getToken } from '@/lib/api'
import { Plus, Tag, ToggleLeft, ToggleRight, Pencil, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { LoadingScreen } from '@/components/LoadingScreen'
import { useConfirm } from '@/components/ConfirmModal'
import { useToast } from '@/components/Toast'
import { Spinner } from '@/components/Spinner'

const EMPTY = { name: '', discount_pct: '', discount_amt: '', min_order: '', starts_at: '', ends_at: '' }

export default function PromotionsPage() {
  const params = useParams() as { slug: string }
  const [promos, setPromos] = useState<any[]>([])
  const [token, setToken] = useState('')
  const [rid, setRid] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [formSubmitted, setFormSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<Record<string, boolean>>({})
  const { confirm } = useConfirm()
  const toast = useToast()
  const [pageLoading, setPageLoading] = useState(true)

  useEffect(() => {
    const t = getToken()
    setToken(t)
    api.get(`/restaurants/${params.slug}`, t).then((r: any) => { setRid(r.id); load(t, r.id) })
  }, [])

  async function load(t: string, restaurantId: string) {
    setPromos(await api.get(`/promotions?restaurantId=${restaurantId}`, t).catch(() => []))
    setPageLoading(false)
  }

  function openAdd() {
    setEditingId(null); setForm(EMPTY); setFormSubmitted(false); setShowForm(true)
  }
  function openEdit(p: any) {
    setEditingId(p.id)
    setForm({
      name: p.name, discount_pct: String(p.discount_pct ?? ''), discount_amt: String(p.discount_amt ?? ''),
      min_order: String(p.min_order ?? ''),
      starts_at: p.starts_at ? new Date(p.starts_at).toISOString().slice(0, 16) : '',
      ends_at: p.ends_at ? new Date(p.ends_at).toISOString().slice(0, 16) : '',
    })
    setFormSubmitted(false); setShowForm(true)
    document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setFormSubmitted(true)
    if (!form.name) return
    const body = {
      restaurantId: rid, name: form.name,
      discount_pct: parseFloat(form.discount_pct) || 0,
      discount_amt: parseFloat(form.discount_amt) || 0,
      min_order: parseFloat(form.min_order) || 0,
      starts_at: form.starts_at || null,
      ends_at: form.ends_at || null,
    }
    setSaving(true)
    try {
      if (editingId) {
        await api.put(`/promotions/${editingId}`, body, token)
      } else {
        await api.post('/promotions', body, token)
      }
      setShowForm(false); setEditingId(null); setFormSubmitted(false); setForm(EMPTY); load(token, rid)
    } catch (e: any) { toast.error(e.message ?? 'บันทึกไม่สำเร็จ') }
    finally { setSaving(false) }
  }

  async function togglePromo(id: string) {
    setBusyId(b => ({ ...b, [id]: true }))
    try { await api.patch(`/promotions/${id}/toggle`, {}, token); load(token, rid) }
    catch (e: any) { toast.error(e.message ?? 'เกิดข้อผิดพลาด') }
    finally { setBusyId(b => ({ ...b, [id]: false })) }
  }
  async function del(id: string, name: string) {
    if (!await confirm({ title: `ลบโปรโมชั่น "${name}"?`, danger: true, confirmLabel: 'ลบ' })) return
    setBusyId(b => ({ ...b, [id]: true }))
    try { await api.delete(`/promotions/${id}`, token); load(token, rid) }
    catch (e: any) { toast.error(e.message ?? 'ลบไม่สำเร็จ') }
    finally { setBusyId(b => ({ ...b, [id]: false })) }
  }

  if (pageLoading) return <LoadingScreen />

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-text text-balance">🎁 โปรโมชั่น</h1>
          <p className="text-muted text-sm mt-0.5">{promos.length} รายการ</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> สร้างโปรโมชั่น
        </button>
      </div>

      {showForm && (
        <div className="card p-5 mb-6 anim-pop">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-text">{editingId ? '✏️ แก้ไขโปรโมชั่น' : 'สร้างโปรโมชั่นใหม่'}</p>
            <button onClick={() => { setShowForm(false); setEditingId(null) }} className="text-muted hover:text-text"><X size={18} /></button>
          </div>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="block text-xs text-muted mb-1.5">ชื่อโปรโมชั่น <span className="text-rose">*</span></label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="ลด 10% วันสุดท้าย"
                className={cn('input', formSubmitted && !form.name && 'input-error')} />
              {formSubmitted && !form.name && <p className="field-error">กรุณากรอกชื่อโปรโมชั่น</p>}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-muted mb-1.5">ส่วนลด %</label>
                <input type="number" value={form.discount_pct} onChange={e => setForm(f => ({ ...f, discount_pct: e.target.value }))} placeholder="10" className="input" />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1.5">ส่วนลด ฿</label>
                <input type="number" value={form.discount_amt} onChange={e => setForm(f => ({ ...f, discount_amt: e.target.value }))} placeholder="50" className="input" />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1.5">ขั้นต่ำ ฿</label>
                <input type="number" value={form.min_order} onChange={e => setForm(f => ({ ...f, min_order: e.target.value }))} placeholder="300" className="input" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted mb-1.5">เริ่ม</label>
                <input type="datetime-local" value={form.starts_at} onChange={e => setForm(f => ({ ...f, starts_at: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1.5">สิ้นสุด</label>
                <input type="datetime-local" value={form.ends_at} onChange={e => setForm(f => ({ ...f, ends_at: e.target.value }))} className="input" />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={saving} className="btn-primary gap-2 disabled:opacity-70">
                {saving ? <><Spinner size={14} /> กำลังบันทึก...</> : (editingId ? 'บันทึกการแก้ไข' : 'บันทึก')}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditingId(null) }} disabled={saving} className="btn-secondary">ยกเลิก</button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-2">
        {promos.map((p: any) => (
          <div key={p.id} className={cn('card flex items-center gap-4 p-4 transition-all', !p.is_active ? 'opacity-50' : 'hover:border-border2', editingId === p.id && 'ring-2 ring-accent/40')}>
            <div className="size-9 rounded-xl bg-violet/10 flex items-center justify-center shrink-0">
              <Tag size={16} className="text-violet" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{p.name}</p>
              <p className="text-xs text-muted mt-0.5">
                {p.discount_pct > 0 && `ลด ${p.discount_pct}%`}
                {p.discount_amt > 0 && `ลด ฿${p.discount_amt}`}
                {p.min_order > 0 && ` · ขั้นต่ำ ฿${p.min_order}`}
              </p>
            </div>
            <span className={`badge shrink-0 ${p.is_active ? 'bg-green/10 text-green' : 'bg-bg3 text-muted'}`}>
              {p.is_active ? 'ใช้งาน' : 'ปิด'}
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <button onClick={() => openEdit(p)} className="size-8 rounded-xl bg-blue/10 text-blue flex items-center justify-center hover:bg-blue/20 transition-colors" data-tooltip="แก้ไข">
                <Pencil size={13} />
              </button>
              <button onClick={() => togglePromo(p.id)} disabled={busyId[p.id]} className="text-muted hover:text-text transition-colors disabled:opacity-50">
                {busyId[p.id] ? <Spinner size={16} /> : p.is_active ? <ToggleRight size={22} className="text-green" /> : <ToggleLeft size={22} />}
              </button>
              <button onClick={() => del(p.id, p.name)} disabled={busyId[p.id]} className="size-8 rounded-xl bg-rose/10 text-rose flex items-center justify-center hover:bg-rose/20 transition-colors disabled:opacity-50" data-tooltip="ลบ">
                {busyId[p.id] ? <Spinner size={13} /> : <Trash2 size={13} />}
              </button>
            </div>
          </div>
        ))}
        {promos.length === 0 && (
          <div className="card p-12 text-center">
            <Tag size={28} className="text-muted mx-auto mb-3 opacity-40" />
            <p className="text-muted text-sm">ยังไม่มีโปรโมชั่น</p>
          </div>
        )}
      </div>
    </div>
  )
}
