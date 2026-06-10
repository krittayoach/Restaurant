'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { api, getToken } from '@/lib/api'
import { Plus, UserCheck, UserX, X, Eye, EyeOff, Pencil, Trash2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { LoadingScreen } from '@/components/LoadingScreen'
import { useConfirm } from '@/components/ConfirmModal'
import { useToast } from '@/components/Toast'
import { Spinner } from '@/components/Spinner'

const ROLE: Record<string, { label: string; emoji: string; cls: string }> = {
  manager:  { label: 'ผู้จัดการ', emoji: '👔', cls: 'bg-accent/10 text-accent' },
  employee: { label: 'พนักงาน',  emoji: '🧑‍💼', cls: 'bg-blue/10 text-blue' },
  chef:     { label: 'พ่อครัว',  emoji: '👨‍🍳', cls: 'bg-teal/10 text-teal' },
}

const EMPTY = { name: '', phone: '', password: '', role: 'employee', salary: '' }

export default function EmployeesPage() {
  const params = useParams() as { slug: string }
  const [employees, setEmployees] = useState<any[]>([])
  const [token, setToken] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [formSubmitted, setFormSubmitted] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<Record<string, boolean>>({})
  const { confirm } = useConfirm()
  const toast = useToast()
  const [pageLoading, setPageLoading] = useState(true)

  useEffect(() => {
    const t = getToken()
    setToken(t); load(t)
  }, [])

  async function load(t: string) {
    setEmployees(await api.get('/employees', t).catch(() => []))
    setPageLoading(false)
  }

  function openAdd() {
    setEditingId(null); setForm(EMPTY); setFormSubmitted(false); setShowPw(false); setShowForm(true)
  }
  function openEdit(emp: any) {
    setEditingId(emp.id)
    setForm({ name: emp.name, phone: emp.phone, password: '', role: emp.role, salary: String(emp.salary ?? '') })
    setFormSubmitted(false); setShowPw(false); setShowForm(true)
    document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setFormSubmitted(true)
    if (!form.name || !form.phone) return
    if (!editingId && (!form.password || form.password.length < 6)) return
    if (editingId && form.password && form.password.length < 6) return

    setSaving(true)
    try {
      if (editingId) {
        const body: any = { name: form.name, phone: form.phone }
        if (form.password) body.password = form.password
        await api.put(`/employees/${editingId}`, body, token)
        if (form.salary !== '') await api.patch(`/employees/${editingId}/salary`, { salary: parseFloat(form.salary) || 0 }, token)
      } else {
        await api.post('/employees', { ...form, salary: parseFloat(form.salary) || 0 }, token)
      }
      setShowForm(false); setEditingId(null); setFormSubmitted(false); setForm(EMPTY); load(token)
    } catch (e: any) { toast.error(e.message ?? 'บันทึกไม่สำเร็จ') }
    finally { setSaving(false) }
  }

  async function toggle(id: string) {
    setBusyId(b => ({ ...b, [id]: true }))
    try { await api.patch(`/employees/${id}/toggle`, {}, token); load(token) }
    catch (e: any) { toast.error(e.message ?? 'เกิดข้อผิดพลาด') }
    finally { setBusyId(b => ({ ...b, [id]: false })) }
  }
  async function del(id: string, name: string) {
    if (!await confirm({ title: `ลบพนักงาน "${name}"?`, message: 'ไม่สามารถเรียกคืนได้', danger: true, confirmLabel: 'ลบ' })) return
    setBusyId(b => ({ ...b, [id]: true }))
    try { await api.delete(`/employees/${id}`, token); load(token) }
    catch (e: any) { toast.error(e.message ?? 'ลบไม่สำเร็จ') }
    finally { setBusyId(b => ({ ...b, [id]: false })) }
  }

  if (pageLoading) return <LoadingScreen />

  return (
    <div className="p-5 md:p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6 anim-up">
        <div>
          <h1 className="font-display font-bold text-2xl md:text-3xl text-text text-balance">👥 พนักงาน</h1>
          <p className="text-muted text-sm mt-0.5">{employees.filter(e => e.is_active).length} คนกำลังทำงาน</p>
        </div>
        <button onClick={openAdd} className="btn-primary"><Plus size={16} /> เพิ่มคน</button>
      </div>

      {showForm && (
        <div className="card p-5 md:p-6 mb-6 anim-pop">
          <div className="flex items-center justify-between mb-4">
            <p className="font-display font-semibold text-base">{editingId ? '✏️ แก้ไขพนักงาน' : 'เพิ่มพนักงานใหม่'}</p>
            <button onClick={() => { setShowForm(false); setEditingId(null) }} className="text-muted hover:text-text"><X size={18} /></button>
          </div>
          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted mb-1.5 ml-1">ชื่อ <span className="text-rose">*</span></label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="สมชาย ใจดี"
                  className={`input ${formSubmitted && !form.name ? 'input-error' : ''}`} />
                {formSubmitted && !form.name && <p className="field-error">กรุณากรอกชื่อ</p>}
              </div>
              <div>
                <label className="block text-xs text-muted mb-1.5 ml-1">เบอร์โทร <span className="text-rose">*</span></label>
                <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="0XX-XXX-XXXX"
                  className={`input ${formSubmitted && !form.phone ? 'input-error' : ''}`} />
                {formSubmitted && !form.phone && <p className="field-error">กรุณากรอกเบอร์โทร</p>}
              </div>
              <div>
                <label className="block text-xs text-muted mb-1.5 ml-1">
                  รหัสผ่าน {editingId ? <span className="text-muted/60">(เว้นว่างถ้าไม่เปลี่ยน)</span> : <span className="text-rose">*</span>}
                </label>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••••"
                    className={`input pr-11 ${formSubmitted && ((!editingId && !form.password) || (form.password && form.password.length < 6)) ? 'input-error' : ''}`} />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    aria-label={showPw ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text transition-colors p-1">
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {formSubmitted && !editingId && !form.password && <p className="field-error">กรุณากรอกรหัสผ่าน</p>}
                {formSubmitted && form.password && form.password.length < 6 && <p className="field-error">รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร</p>}
              </div>
              <div>
                <label className="block text-xs text-muted mb-1.5 ml-1">เงินเดือน (฿)</label>
                <input type="number" value={form.salary} onChange={e => setForm(f => ({ ...f, salary: e.target.value }))} placeholder="12000" className="input" />
              </div>
            </div>
            {!editingId && (
              <div>
                <label className="block text-xs text-muted mb-1.5 ml-1">ตำแหน่ง</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className="input">
                  <option value="employee">🧑‍💼 พนักงาน</option>
                  <option value="chef">👨‍🍳 พ่อครัว</option>
                  <option value="manager">👔 ผู้จัดการ</option>
                </select>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={saving} className="btn-primary gap-2 disabled:opacity-70">
                {saving ? <><Spinner size={14} /> กำลังบันทึก...</> : (editingId ? 'บันทึกการแก้ไข' : 'บันทึก')}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditingId(null) }} disabled={saving} className="btn-secondary">ยกเลิก</button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-2.5">
        {employees.map((emp: any, i: number) => {
          const r = ROLE[emp.role] ?? { label: emp.role, emoji: '👤', cls: 'bg-bg3 text-muted' }
          return (
            <div key={emp.id} className={cn('card card-hover flex items-center gap-3 md:gap-4 p-4 anim-up', !emp.is_active && 'opacity-50', editingId === emp.id && 'ring-2 ring-accent/40')}
              style={{ animationDelay: `${i * 40}ms` }}>
              <div className="size-11 rounded-2xl bg-bg3 flex items-center justify-center text-xl shrink-0">{r.emoji}</div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{emp.name}</p>
                <p className="text-xs text-muted font-mono">{emp.phone}</p>
              </div>
              <span className={`badge ${r.cls} shrink-0 hidden sm:inline-flex`}>{r.label}</span>
              <p className="font-display font-bold text-green text-sm shrink-0">฿{(emp.salary ?? 0).toLocaleString()}</p>
              <div className="flex gap-1.5 shrink-0">
                <button onClick={() => openEdit(emp)} className="size-9 rounded-xl bg-blue/10 text-blue flex items-center justify-center hover:bg-blue/20 transition-colors" data-tooltip="แก้ไข">
                  <Pencil size={14} />
                </button>
                <button onClick={() => toggle(emp.id)} disabled={busyId[emp.id]} className={cn('size-9 rounded-xl flex items-center justify-center transition-all active:scale-95 disabled:opacity-50', emp.is_active ? 'bg-rose/10 text-rose' : 'bg-green/10 text-green')} data-tooltip={emp.is_active ? 'ระงับ' : 'เปิดใช้งาน'}>
                  {busyId[emp.id] ? <Spinner size={13} /> : emp.is_active ? <UserX size={14} /> : <UserCheck size={14} />}
                </button>
                <button onClick={() => del(emp.id, emp.name)} disabled={busyId[emp.id]} className="size-9 rounded-xl bg-rose/10 text-rose flex items-center justify-center hover:bg-rose/20 transition-colors disabled:opacity-50" data-tooltip="ลบ">
                  {busyId[emp.id] ? <Spinner size={13} /> : <Trash2 size={14} />}
                </button>
              </div>
            </div>
          )
        })}
        {employees.length === 0 && <div className="card p-12 text-center text-muted text-sm">👥 ยังไม่มีพนักงาน</div>}
      </div>
    </div>
  )
}
