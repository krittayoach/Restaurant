'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { api, getToken } from '@/lib/api'
import { Settings, Save, Check, Lock, Eye, EyeOff } from 'lucide-react'
import { LoadingScreen } from '@/components/LoadingScreen'
import { useToast } from '@/components/Toast'

export default function SettingsPage() {
  const params = useParams() as { slug: string }
  const [token, setToken] = useState('')
  const [pageLoading, setPageLoading] = useState(true)
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({ name: '', promptpay: '', open_time: '08:00', close_time: '22:00' })
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [pwSaving, setPwSaving] = useState(false)
  const [pwSaved, setPwSaved] = useState(false)
  const [showPw, setShowPw] = useState(false)

  useEffect(() => {
    const t = getToken()
    setToken(t)
    api.get(`/restaurants/${params.slug}`, t).then((r: any) => {
      setForm({
        name: r.name ?? '',
        promptpay: r.promptpay ?? '',
        open_time: r.open_time ?? '08:00',
        close_time: r.close_time ?? '22:00',
      })
      setPageLoading(false)
    }).catch(() => setPageLoading(false))
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    try {
      await api.patch('/restaurants/settings', {
        name: form.name.trim(),
        promptpay: form.promptpay.trim() || undefined,
        open_time: form.open_time,
        close_time: form.close_time,
      }, token)
      setSaved(true)
      toast.success('บันทึกข้อมูลร้านเรียบร้อยแล้ว')
      setTimeout(() => setSaved(false), 2500)
    } catch (err: any) {
      toast.error(err.message ?? 'บันทึกไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    if (pwForm.next.length < 6) { toast.error('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร'); return }
    if (pwForm.next !== pwForm.confirm) { toast.error('รหัสผ่านใหม่ไม่ตรงกัน'); return }
    setPwSaving(true)
    try {
      await api.patch('/auth/change-password', { currentPassword: pwForm.current, newPassword: pwForm.next }, token)
      setPwSaved(true)
      setPwForm({ current: '', next: '', confirm: '' })
      toast.success('เปลี่ยนรหัสผ่านเรียบร้อยแล้ว')
      setTimeout(() => setPwSaved(false), 2500)
    } catch (err: any) {
      toast.error(err.message ?? 'เปลี่ยนรหัสผ่านไม่สำเร็จ')
    } finally {
      setPwSaving(false)
    }
  }

  if (pageLoading) return <LoadingScreen />

  return (
    <div className="p-5 md:p-8 max-w-xl mx-auto">
      <div className="flex items-center gap-3 mb-7 anim-up">
        <div className="w-11 h-11 rounded-2xl bg-accent/10 flex items-center justify-center">
          <Settings size={20} className="text-accent" />
        </div>
        <div>
          <h1 className="font-display font-bold text-2xl text-text">ตั้งค่าร้าน</h1>
          <p className="text-muted text-sm">แก้ไขข้อมูลทั่วไปของร้าน</p>
        </div>
      </div>

      <form onSubmit={submit} className="card p-6 space-y-5 anim-up" style={{ animationDelay: '40ms' }}>
        {/* ชื่อร้าน */}
        <div>
          <label className="block text-xs font-medium text-muted mb-1.5 ml-1">
            ชื่อร้าน <span className="text-rose">*</span>
          </label>
          <input
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="ร้านอาหารของฉัน"
            className="input"
          />
        </div>

        {/* PromptPay */}
        <div>
          <label className="block text-xs font-medium text-muted mb-1.5 ml-1">เลข PromptPay</label>
          <input
            value={form.promptpay}
            onChange={e => setForm(f => ({ ...f, promptpay: e.target.value }))}
            placeholder="0812345678 หรือเลขประจำตัว 13 หลัก"
            className="input"
          />
          <p className="text-xs text-muted/60 mt-1 ml-1">ใช้สำหรับรับชำระเงินผ่าน QR code</p>
        </div>

        {/* เวลาเปิด-ปิด */}
        <div>
          <label className="block text-xs font-medium text-muted mb-1.5 ml-1">เวลาทำการ</label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted mb-1 ml-1">เปิด</p>
              <input
                type="time"
                value={form.open_time}
                onChange={e => setForm(f => ({ ...f, open_time: e.target.value }))}
                className="input"
              />
            </div>
            <div>
              <p className="text-xs text-muted mb-1 ml-1">ปิด</p>
              <input
                type="time"
                value={form.close_time}
                onChange={e => setForm(f => ({ ...f, close_time: e.target.value }))}
                className="input"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving || !form.name.trim()}
          className={`btn-primary w-full justify-center gap-2 transition-all ${saved ? 'bg-green hover:bg-green' : ''}`}
        >
          {saved ? (
            <><Check size={16} /> บันทึกแล้ว</>
          ) : saving ? (
            <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> กำลังบันทึก...</>
          ) : (
            <><Save size={16} /> บันทึก</>
          )}
        </button>
      </form>
      {/* Change password */}
      <form onSubmit={changePassword} className="card p-6 space-y-4 anim-up" style={{ animationDelay: '80ms' }}>
        <div className="flex items-center gap-2.5 mb-1">
          <Lock size={16} className="text-muted" />
          <h2 className="font-display font-semibold text-base">เปลี่ยนรหัสผ่าน</h2>
        </div>

        {[
          { key: 'current', label: 'รหัสผ่านปัจจุบัน' },
          { key: 'next',    label: 'รหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)' },
          { key: 'confirm', label: 'ยืนยันรหัสผ่านใหม่' },
        ].map(({ key, label }) => (
          <div key={key} className="relative">
            <label className="block text-xs font-medium text-muted mb-1.5 ml-1">{label}</label>
            <input
              type={showPw ? 'text' : 'password'}
              value={(pwForm as any)[key]}
              onChange={e => setPwForm(f => ({ ...f, [key]: e.target.value }))}
              placeholder="••••••••"
              className="input pr-11"
            />
            {key === 'current' && (
              <button type="button" onClick={() => setShowPw(v => !v)}
                className="absolute right-3 bottom-3 text-muted hover:text-text transition-colors">
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            )}
          </div>
        ))}

        <button type="submit" disabled={pwSaving || !pwForm.current || !pwForm.next || !pwForm.confirm}
          className={`btn-primary w-full justify-center gap-2 transition-all ${pwSaved ? 'bg-green hover:bg-green' : ''}`}>
          {pwSaved ? <><Check size={16} /> เปลี่ยนแล้ว</>
            : pwSaving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> กำลังเปลี่ยน...</>
            : <><Lock size={16} /> เปลี่ยนรหัสผ่าน</>}
        </button>
      </form>
    </div>
  )
}
