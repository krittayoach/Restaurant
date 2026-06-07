'use client'
import { useState, useEffect } from 'react'
import { api, getToken } from '@/lib/api'
import { ShieldCheck, KeyRound, Check, Store, LogOut } from 'lucide-react'
import { useToast } from '@/components/Toast'
import { useRouter } from 'next/navigation'

export default function AdminPage() {
  const toast = useToast()
  const router = useRouter()
  const [token, setToken] = useState('')
  const [restaurants, setRestaurants] = useState<any[]>([])
  const [loadingRests, setLoadingRests] = useState(true)
  const [pwForm, setPwForm] = useState({ phone: '', newPassword: '' })
  const [pwSaving, setPwSaving] = useState(false)
  const [pwSaved, setPwSaved] = useState(false)
  const [showPwResult, setShowPwResult] = useState('')

  useEffect(() => {
    const t = getToken()
    setToken(t)
    api.get('/restaurants/all', t)
      .then(setRestaurants)
      .catch(() => setRestaurants([]))
      .finally(() => setLoadingRests(false))
  }, [])

  async function resetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!pwForm.phone || pwForm.newPassword.length < 6) {
      toast.error('กรอกเบอร์โทรและรหัสผ่านใหม่อย่างน้อย 6 ตัวอักษร')
      return
    }
    setPwSaving(true)
    try {
      const res = await api.patch('/auth/reset-password', pwForm, token)
      setShowPwResult(`✅ รีเซ็ตสำเร็จ — ${res.name} (${res.role})`)
      setPwSaved(true)
      setPwForm({ phone: '', newPassword: '' })
      setTimeout(() => { setPwSaved(false); setShowPwResult('') }, 5000)
    } catch (e: any) {
      toast.error(e.message ?? 'รีเซ็ตไม่สำเร็จ')
    } finally {
      setPwSaving(false)
    }
  }

  async function logout() {
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/logout`, { method: 'POST', credentials: 'include' })
    router.push('/login')
  }

  const PLAN_CLS: Record<string, string> = {
    free: 'bg-bg3 text-muted',
    basic: 'bg-blue/10 text-blue',
    pro: 'bg-accent/10 text-accent',
  }

  return (
    <div className="min-h-screen bg-bg p-6 md:p-10">
      {/* Header */}
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8 anim-up">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-yellow/10 flex items-center justify-center">
              <ShieldCheck size={24} className="text-yellow" />
            </div>
            <div>
              <h1 className="font-display font-bold text-2xl text-text">Super Admin</h1>
              <p className="text-muted text-sm">จัดการระบบทั้งหมด</p>
            </div>
          </div>
          <button onClick={logout}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-bg2 border border-border text-muted text-sm hover:text-rose hover:border-rose/30 transition-all">
            <LogOut size={15} /> ออกจากระบบ
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Reset Password */}
          <div className="card p-6 anim-up" style={{ animationDelay: '40ms' }}>
            <div className="flex items-center gap-2.5 mb-5">
              <KeyRound size={18} className="text-yellow" />
              <h2 className="font-display font-semibold text-base">รีเซ็ตรหัสผ่าน</h2>
            </div>
            <form onSubmit={resetPassword} className="space-y-3">
              <div>
                <label className="block text-xs text-muted mb-1.5 ml-1">เบอร์โทรของ user</label>
                <input
                  value={pwForm.phone}
                  onChange={e => setPwForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="0812345678"
                  className="input"
                />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1.5 ml-1">รหัสผ่านใหม่</label>
                <input
                  type="password"
                  value={pwForm.newPassword}
                  onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))}
                  placeholder="อย่างน้อย 6 ตัวอักษร"
                  className="input"
                />
              </div>
              {showPwResult && (
                <p className="text-sm text-green bg-green/10 rounded-xl px-4 py-2.5">{showPwResult}</p>
              )}
              <button type="submit" disabled={pwSaving}
                className={`btn-primary w-full justify-center gap-2 ${pwSaved ? 'bg-green hover:bg-green' : 'bg-yellow hover:bg-yellow/90'}`}
                style={{ boxShadow: '0 6px 16px -6px rgba(217,119,6,.5)' }}>
                {pwSaved
                  ? <><Check size={16} /> รีเซ็ตแล้ว</>
                  : pwSaving
                    ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> กำลังรีเซ็ต...</>
                    : <><KeyRound size={16} /> รีเซ็ตรหัสผ่าน</>}
              </button>
            </form>
          </div>

          {/* Restaurants list */}
          <div className="card p-6 anim-up" style={{ animationDelay: '80ms' }}>
            <div className="flex items-center gap-2.5 mb-5">
              <Store size={18} className="text-yellow" />
              <h2 className="font-display font-semibold text-base">ร้านทั้งหมด</h2>
              <span className="ml-auto text-xs text-muted">{restaurants.length} ร้าน</span>
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {loadingRests ? (
                <div className="space-y-2">
                  {[1,2,3].map(i => <div key={i} className="h-12 skeleton rounded-xl" />)}
                </div>
              ) : restaurants.length === 0 ? (
                <p className="text-muted text-sm text-center py-6">ยังไม่มีร้าน</p>
              ) : restaurants.map((r: any) => (
                <div key={r.id} className="flex items-center gap-3 p-3 rounded-2xl bg-bg3">
                  <div className="w-8 h-8 rounded-xl bg-accent/10 flex items-center justify-center text-sm shrink-0">🍜</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{r.name}</p>
                    <p className="text-xs text-muted font-mono">{r.slug}</p>
                  </div>
                  <span className={`badge text-xs ${PLAN_CLS[r.plan] ?? 'bg-bg3 text-muted'}`}>{r.plan}</span>
                  <div className={`w-2 h-2 rounded-full shrink-0 ${r.is_active ? 'bg-green' : 'bg-rose'}`} title={r.is_active ? 'active' : 'inactive'} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
