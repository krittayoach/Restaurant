'use client'
import { useState, useEffect } from 'react'
import { api, getToken } from '@/lib/api'
import { ShieldCheck, KeyRound, Check, Store, LogOut, TrendingUp, Zap, X, ExternalLink } from 'lucide-react'
import { useToast } from '@/components/Toast'
import { useRouter } from 'next/navigation'
import { Spinner } from '@/components/Spinner'

export default function AdminPage() {
  const toast = useToast()
  const router = useRouter()
  const [token, setToken] = useState('')
  const [restaurants, setRestaurants] = useState<any[]>([])
  const [loadingRests, setLoadingRests] = useState(true)
  const [billing, setBilling] = useState<any>(null)
  const [pendingPayments, setPendingPayments] = useState<any[]>([])
  const [pwForm, setPwForm] = useState({ phone: '', newPassword: '' })
  const [pwSaving, setPwSaving] = useState(false)
  const [pwSaved, setPwSaved] = useState(false)
  const [showPwResult, setShowPwResult] = useState('')
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [busyId, setBusyId] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const t = getToken()
    setToken(t)
    Promise.all([
      api.get('/restaurants/all', t).catch(() => []),
      api.get('/restaurants/billing', t).catch(() => null),
      api.get('/billing/pending-payments', t).catch(() => []),
    ]).then(([rests, bill, pending]) => {
      setRestaurants(rests ?? [])
      setBilling(bill)
      setPendingPayments(pending ?? [])
      setLoadingRests(false)
    })
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

  async function changePlan(id: string, plan: string) {
    try {
      const updated = await api.patch(`/restaurants/${id}/plan`, { plan }, token)
      setRestaurants(r => r.map(rest => rest.id === id ? { ...rest, plan: updated.plan } : rest))
      toast.success(`เปลี่ยนเป็น ${plan} แล้ว`)
      api.get('/restaurants/billing', token).then(setBilling).catch(() => null)
    } catch (e: any) { toast.error(e.message) }
  }

  async function approvePayment(id: string) {
    setBusyId(b => ({ ...b, [`approve_${id}`]: true }))
    try {
      const res = await api.patch(`/billing/payments/${id}/approve`, {}, token)
      setPendingPayments(p => p.filter(x => x.id !== id))
      setRestaurants(r => r.map(rest => rest.id === (pendingPayments.find(x => x.id === id)?.restaurant_id) ? { ...rest, plan: res.plan } : rest))
      toast.success('อนุมัติและอัปเกรด plan แล้ว')
      api.get('/restaurants/billing', token).then(setBilling).catch(() => null)
    } catch (e: any) { toast.error(e.message) }
    finally { setBusyId(b => ({ ...b, [`approve_${id}`]: false })) }
  }

  async function rejectPayment() {
    if (!rejectId) return
    setRejecting(true)
    try {
      await api.patch(`/billing/payments/${rejectId}/reject`, { note: rejectNote || undefined }, token)
      setPendingPayments(p => p.filter(x => x.id !== rejectId))
      setRejectId(null); setRejectNote('')
      toast.success('ปฏิเสธคำขอแล้ว')
    } catch (e: any) { toast.error(e.message) }
    finally { setRejecting(false) }
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
      <div className="max-w-4xl mx-auto">
        {/* Header */}
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

        {/* Billing summary */}
        {billing && (
          <div className="card p-6 mb-6 anim-up">
            <div className="flex items-center gap-2.5 mb-5">
              <TrendingUp size={18} className="text-yellow" />
              <h2 className="font-display font-semibold text-base">รายได้ประมาณการ</h2>
              <span className="ml-auto font-display font-bold text-xl text-accent">฿{billing.revenue.toLocaleString()}/เดือน</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { plan: 'free',  label: 'Free',  color: 'text-muted  bg-bg3',       price: '฿0' },
                { plan: 'basic', label: 'Basic', color: 'text-blue   bg-blue/10',   price: '฿299' },
                { plan: 'pro',   label: 'Pro',   color: 'text-accent bg-accent/10', price: '฿799' },
              ].map(p => {
                const s = billing.summary?.find((s: any) => s.plan === p.plan)
                return (
                  <div key={p.plan} className={`rounded-2xl p-4 ${p.color}`}>
                    <p className="font-bold text-2xl">{s?.count ?? 0}</p>
                    <p className="text-xs mt-0.5">{p.label} · {p.price}/เดือน</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Pending plan upgrade requests */}
        {pendingPayments.length > 0 && (
          <div className="card p-6 mb-6 anim-up border-yellow/30 border">
            <div className="flex items-center gap-2.5 mb-4">
              <Zap size={18} className="text-yellow" />
              <h2 className="font-display font-semibold text-base">คำขออัปเกรดแพ็กเกจ</h2>
              <span className="ml-auto bg-yellow/20 text-yellow text-xs font-bold px-2.5 py-0.5 rounded-full">{pendingPayments.length} รายการ</span>
            </div>
            <div className="space-y-3">
              {pendingPayments.map(pmt => (
                <div key={pmt.id} className="bg-bg3 rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="font-semibold text-sm">{pmt.restaurant_name}</p>
                      <p className="text-xs text-muted font-mono">{pmt.restaurant_slug}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${PLAN_CLS[pmt.current_plan] ?? ''}`}>{pmt.current_plan}</span>
                        <span className="text-xs text-muted">→</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${PLAN_CLS[pmt.plan] ?? ''}`}>{pmt.plan}</span>
                        <span className="text-xs text-muted">฿{pmt.amount.toLocaleString()}</span>
                        <span className="text-xs text-muted capitalize">({pmt.method})</span>
                      </div>
                    </div>
                    {pmt.slip_url && (
                      <a href={pmt.slip_url} target="_blank" rel="noopener noreferrer"
                        className="shrink-0 flex items-center gap-1 text-xs text-blue hover:underline">
                        <ExternalLink size={12} /> ดูสลิป
                      </a>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => approvePayment(pmt.id)} disabled={busyId[`approve_${pmt.id}`]}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-green/10 text-green text-sm font-semibold hover:bg-green/20 transition-all disabled:opacity-60">
                      {busyId[`approve_${pmt.id}`] ? <Spinner size={14} /> : <Check size={14} />} อนุมัติ
                    </button>
                    <button onClick={() => { setRejectId(pmt.id); setRejectNote('') }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-rose/10 text-rose text-sm font-semibold hover:bg-rose/20 transition-all">
                      <X size={14} /> ปฏิเสธ
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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
                <input value={pwForm.phone} onChange={e => setPwForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="0812345678" className="input" />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1.5 ml-1">รหัสผ่านใหม่</label>
                <input type="password" value={pwForm.newPassword}
                  onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))}
                  placeholder="อย่างน้อย 6 ตัวอักษร" className="input" />
              </div>
              {showPwResult && (
                <p className="text-sm text-green bg-green/10 rounded-xl px-4 py-2.5">{showPwResult}</p>
              )}
              <button type="submit" disabled={pwSaving}
                className={`btn-primary w-full justify-center gap-2 ${pwSaved ? 'bg-green hover:bg-green' : 'bg-yellow hover:bg-yellow/90'}`}
                style={{ boxShadow: '0 6px 16px -6px rgba(217,119,6,.5)' }}>
                {pwSaved ? <><Check size={16} /> รีเซ็ตแล้ว</>
                  : pwSaving ? <><Spinner size={16} /> กำลังรีเซ็ต...</>
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
                  <select value={r.plan} onChange={e => changePlan(r.id, e.target.value)}
                    className={`text-xs px-2 py-1 rounded-lg border-0 font-semibold cursor-pointer ${PLAN_CLS[r.plan] ?? 'bg-bg3 text-muted'}`}>
                    <option value="free">free</option>
                    <option value="basic">basic</option>
                    <option value="pro">pro</option>
                  </select>
                  <div className={`w-2 h-2 rounded-full shrink-0 ${r.is_active ? 'bg-green' : 'bg-rose'}`} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Reject modal */}
      {rejectId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg2 rounded-3xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="font-display font-bold text-lg mb-4">ปฏิเสธคำขอ</h3>
            <textarea value={rejectNote} onChange={e => setRejectNote(e.target.value)}
              placeholder="เหตุผล (ไม่บังคับ)" rows={3}
              className="input resize-none mb-4" />
            <div className="flex gap-3">
              <button onClick={() => setRejectId(null)}
                className="flex-1 py-2.5 rounded-2xl bg-bg3 text-sm font-semibold text-muted hover:text-text transition-colors">
                ยกเลิก
              </button>
              <button onClick={rejectPayment} disabled={rejecting}
                className="flex-1 py-2.5 rounded-2xl bg-rose/90 text-white text-sm font-semibold hover:bg-rose transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
                {rejecting && <Spinner size={14} />}ปฏิเสธ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
