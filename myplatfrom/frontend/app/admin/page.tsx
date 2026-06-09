'use client'
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { api, getToken } from '@/lib/api'
import {
  ShieldCheck, KeyRound, Check, Store, LogOut, TrendingUp, Zap, X,
  ExternalLink, Users, Power, PowerOff, Search, ChevronDown,
  BadgeCheck, Bell, UserPlus, CreditCard,
} from 'lucide-react'
import { useToast } from '@/components/Toast'
import { useRouter } from 'next/navigation'
import { Spinner } from '@/components/Spinner'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3010'

const PLAN_CLS: Record<string, string> = {
  free:  'bg-bg3 text-muted',
  basic: 'bg-blue/10 text-blue',
  pro:   'bg-accent/10 text-accent',
}
const PLAN_PRICE: Record<string, number> = { free: 0, basic: 299, pro: 799 }

export default function AdminPage() {
  const toast  = useToast()
  const router = useRouter()
  const [token, setToken] = useState('')

  const [restaurants, setRestaurants]     = useState<any[]>([])
  const [loadingRests, setLoadingRests]   = useState(true)
  const [billing, setBilling]             = useState<any>(null)
  const [pendingPayments, setPendingPayments] = useState<any[]>([])

  const [notifications, setNotifications] = useState<any[]>([])
  const [showNotif, setShowNotif]         = useState(false)
  const [unread, setUnread]               = useState(0)
  const notifRef = useRef<HTMLDivElement>(null)

  const [search, setSearch]       = useState('')
  const [planFilter, setPlanFilter] = useState('all')

  const [pwForm, setPwForm]     = useState({ phone: '', newPassword: '' })
  const [pwErrors, setPwErrors] = useState({ phone: '', newPassword: '' })
  const [pwSaving, setPwSaving] = useState(false)
  const [pwSaved, setPwSaved]   = useState(false)
  const [pwResult, setPwResult] = useState('')

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [suspendTarget, setSuspendTarget] = useState<{ id: string; name: string } | null>(null)
  const [suspendReason, setSuspendReason] = useState('')
  const [suspendSubmitted, setSuspendSubmitted] = useState(false)

  const [rejectId, setRejectId]   = useState<string | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [rejecting, setRejecting]   = useState(false)
  const [busyId, setBusyId]         = useState<Record<string, boolean>>({})

  const reloadData = useCallback((t: string) => {
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

  useEffect(() => {
    const t = getToken()
    setToken(t)
    reloadData(t)

    // SSE — admin real-time channel
    let es: EventSource
    let reconnectTimer: ReturnType<typeof setTimeout>
    function connect() {
      es = new EventSource(`${API}/admin/stream?token=${encodeURIComponent(t)}`, { withCredentials: true })
      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data)
          setNotifications(prev => [data, ...prev].slice(0, 50))
          setUnread(n => n + 1)
          if (data.type === 'NEW_RESTAURANT') {
            toast.success(`ร้านใหม่ลงทะเบียน: ${data.restaurant?.name}`)
            api.get('/restaurants/all', t).then(r => setRestaurants(r ?? [])).catch(() => null)
            api.get('/restaurants/billing', t).then(setBilling).catch(() => null)
          } else if (data.type === 'NEW_PAYMENT') {
            toast.success(`คำขออัปเกรด: ${data.restaurant_name} → ${data.plan}`)
            api.get('/billing/pending-payments', t).then(p => setPendingPayments(p ?? [])).catch(() => null)
          }
        } catch {}
      }
      es.onerror = () => {
        es.close()
        reconnectTimer = setTimeout(connect, 3000)
      }
    }
    connect()

    // Close notification panel on outside click
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotif(false)
      }
    }
    document.addEventListener('mousedown', handleClick)

    return () => {
      clearTimeout(reconnectTimer)
      es?.close()
      document.removeEventListener('mousedown', handleClick)
    }
  }, [])

  // ── derived stats ─────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const now       = new Date()
    const monthAgo  = new Date(now.getFullYear(), now.getMonth(), 1)
    const active    = restaurants.filter(r => r.is_active).length
    const newCount  = restaurants.filter(r => new Date(r.created_at) >= monthAgo).length
    const mrr       = restaurants.filter(r => r.is_active)
                        .reduce((acc, r) => acc + (PLAN_PRICE[r.plan] ?? 0), 0)
    return { total: restaurants.length, active, inactive: restaurants.length - active, newCount, mrr }
  }, [restaurants])

  const filtered = useMemo(() => {
    return restaurants.filter(r => {
      const matchSearch = !search ||
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.slug.toLowerCase().includes(search.toLowerCase())
      const matchPlan = planFilter === 'all' || r.plan === planFilter
      return matchSearch && matchPlan
    })
  }, [restaurants, search, planFilter])

  // ── actions ───────────────────────────────────────────────────────────────
  async function unsuspend(id: string) {
    setBusyId(b => ({ ...b, [`active_${id}`]: true }))
    try {
      const updated = await api.patch(`/restaurants/${id}/toggle-active`, {}, token)
      setRestaurants(r => r.map(rest => rest.id === id ? { ...rest, is_active: updated.is_active, suspend_reason: null } : rest))
      toast.success('เปิดใช้งานร้านแล้ว')
    } catch (e: any) { toast.error(e.message) }
    finally { setBusyId(b => ({ ...b, [`active_${id}`]: false })) }
  }

  async function confirmSuspend() {
    if (!suspendTarget) return
    setSuspendSubmitted(true)
    if (!suspendReason.trim()) return
    const { id } = suspendTarget
    setBusyId(b => ({ ...b, [`active_${id}`]: true }))
    setSuspendTarget(null); setSuspendReason(''); setSuspendSubmitted(false)
    try {
      const updated = await api.patch(`/restaurants/${id}/toggle-active`, { reason: suspendReason.trim() }, token)
      setRestaurants(r => r.map(rest => rest.id === id ? { ...rest, is_active: updated.is_active, suspend_reason: updated.suspend_reason } : rest))
      toast.success('ระงับร้านแล้ว')
    } catch (e: any) { toast.error(e.message) }
    finally { setBusyId(b => ({ ...b, [`active_${id}`]: false })) }
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
      setRestaurants(r => r.map(rest =>
        rest.id === (pendingPayments.find(x => x.id === id)?.restaurant_id)
          ? { ...rest, plan: res.plan } : rest
      ))
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

  async function resetPassword(e: React.FormEvent) {
    e.preventDefault()
    const errs = {
      phone:       !pwForm.phone ? 'กรุณากรอกเบอร์โทร' : '',
      newPassword: pwForm.newPassword.length < 6 ? 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' : '',
    }
    setPwErrors(errs)
    if (errs.phone || errs.newPassword) return
    setPwSaving(true)
    try {
      const res = await api.patch('/auth/reset-password', pwForm, token)
      setPwResult(`✅ รีเซ็ตสำเร็จ — ${res.name} (${res.role})`)
      setPwSaved(true)
      setPwForm({ phone: '', newPassword: '' })
      setPwErrors({ phone: '', newPassword: '' })
      setTimeout(() => { setPwSaved(false); setPwResult('') }, 5000)
    } catch (e: any) {
      setPwErrors(prev => ({ ...prev, phone: e.message ?? 'รีเซ็ตไม่สำเร็จ' }))
    }
    finally { setPwSaving(false) }
  }

  async function logout() {
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/logout`, { method: 'POST', credentials: 'include' })
    router.push('/login')
  }

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-bg p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between anim-up relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-yellow/10 flex items-center justify-center">
              <ShieldCheck size={24} className="text-yellow" />
            </div>
            <div>
              <h1 className="font-display font-bold text-2xl text-text">Super Admin</h1>
              <p className="text-muted text-sm">จัดการแพลตฟอร์มทั้งหมด</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Notification bell */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => { setShowNotif(v => !v); setUnread(0) }}
                className="relative w-10 h-10 rounded-2xl bg-bg2 border border-border flex items-center justify-center text-muted hover:text-text transition-all">
                <Bell size={16} />
                {unread > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose text-white text-[10px] font-bold flex items-center justify-center">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </button>

              {showNotif && (
                <div className="absolute right-0 top-12 w-80 bg-bg2 border border-border rounded-2xl shadow-2xl z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                    <span className="font-semibold text-sm">การแจ้งเตือน</span>
                    {notifications.length > 0 && (
                      <button onClick={() => setNotifications([])} className="text-xs text-muted hover:text-rose transition-colors">ล้างทั้งหมด</button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="text-center text-muted text-sm py-8">ยังไม่มีการแจ้งเตือน</p>
                    ) : notifications.map((n, i) => (
                      <NotifItem key={i} notif={n} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button onClick={() => setShowLogoutConfirm(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-bg2 border border-border text-muted text-sm hover:text-rose hover:border-rose/30 transition-all">
              <LogOut size={15} /> ออกจากระบบ
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 anim-up">
          <StatCard icon={<Store size={16} />} label="ร้านทั้งหมด" value={stats.total} color="text-accent" />
          <StatCard icon={<BadgeCheck size={16} />} label="เปิดใช้งาน" value={stats.active} color="text-green" />
          <StatCard icon={<TrendingUp size={16} />} label="MRR (ประมาณ)" value={`฿${stats.mrr.toLocaleString()}`} color="text-yellow" />
          <StatCard icon={<Users size={16} />} label="สมัครเดือนนี้" value={stats.newCount} color="text-blue" />
        </div>

        {/* Pending upgrades */}
        {pendingPayments.length > 0 && (
          <div className="card p-6 anim-up border-yellow/30 border">
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

        {/* Restaurants table */}
        <div className="card p-6 anim-up">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
            <div className="flex items-center gap-2.5">
              <Store size={18} className="text-yellow" />
              <h2 className="font-display font-semibold text-base">ร้านอาหาร</h2>
              <span className="text-xs text-muted">{filtered.length}/{stats.total}</span>
            </div>
            <div className="flex gap-2 sm:ml-auto">
              <div className="relative flex-1 sm:flex-none">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="ค้นหาชื่อ / slug…"
                  className="input pl-8 text-sm py-2 sm:w-52" />
              </div>
              <div className="relative">
                <select value={planFilter} onChange={e => setPlanFilter(e.target.value)}
                  className="input text-sm py-2 pr-8 appearance-none cursor-pointer">
                  <option value="all">ทุก plan</option>
                  <option value="free">Free</option>
                  <option value="basic">Basic</option>
                  <option value="pro">Pro</option>
                </select>
                <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              </div>
            </div>
          </div>

          {loadingRests ? (
            <div className="space-y-2">
              {[1,2,3,4].map(i => <div key={i} className="h-14 skeleton rounded-2xl" />)}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-muted text-sm text-center py-8">ไม่พบร้าน</p>
          ) : (
            <div className="space-y-2">
              {filtered.map((r: any) => (
                <div key={r.id}
                  className={`flex items-center gap-3 p-3 rounded-2xl transition-colors ${r.is_active ? 'bg-bg3' : 'bg-rose/5 border border-rose/15'}`}>

                  {/* Avatar */}
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0 ${r.is_active ? 'bg-accent/10' : 'bg-rose/10'}`}>
                    🍜
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold truncate">{r.name}</p>
                      {!r.is_active && (
                        <span className="text-xs px-1.5 py-0.5 rounded-md bg-rose/10 text-rose font-semibold shrink-0">ระงับ</span>
                      )}
                    </div>
                    <p className="text-xs text-muted font-mono">{r.slug}</p>
                  </div>

                  {/* Plan select */}
                  <div className="relative shrink-0">
                    <select value={r.plan} onChange={e => changePlan(r.id, e.target.value)}
                      className={`text-xs px-2 py-1 rounded-lg border-0 font-semibold cursor-pointer pr-5 appearance-none ${PLAN_CLS[r.plan] ?? 'bg-bg3 text-muted'}`}>
                      <option value="free">Free</option>
                      <option value="basic">Basic</option>
                      <option value="pro">Pro</option>
                    </select>
                    <ChevronDown size={10} className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
                  </div>

                  {/* Joined date */}
                  <p className="text-xs text-muted shrink-0 hidden md:block">
                    {new Date(r.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
                  </p>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => r.is_active ? setSuspendTarget({ id: r.id, name: r.name }) : unsuspend(r.id)}
                      disabled={busyId[`active_${r.id}`]}
                      data-tooltip={r.is_active ? 'ระงับร้าน' : 'เปิดใช้งาน'}
                      className={`w-8 h-8 rounded-xl flex items-center justify-center border transition-all disabled:opacity-60 ${
                        r.is_active
                          ? 'bg-bg2 border-border text-muted hover:text-rose hover:border-rose/30'
                          : 'bg-green/10 border-green/20 text-green hover:bg-green/20'
                      }`}>
                      {busyId[`active_${r.id}`] ? <Spinner size={13} /> : r.is_active ? <PowerOff size={13} /> : <Power size={13} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom row: Reset PW + MRR breakdown */}
        <div className="grid md:grid-cols-2 gap-6 anim-up">
          {/* Reset Password */}
          <div className="card p-6">
            <div className="flex items-center gap-2.5 mb-5">
              <KeyRound size={18} className="text-yellow" />
              <h2 className="font-display font-semibold text-base">รีเซ็ตรหัสผ่าน</h2>
            </div>
            <form onSubmit={resetPassword} className="space-y-3">
              <div>
                <label className="block text-xs text-muted mb-1.5 ml-1">เบอร์โทรของ user</label>
                <input value={pwForm.phone}
                  onChange={e => { setPwForm(f => ({ ...f, phone: e.target.value })); setPwErrors(er => ({ ...er, phone: '' })) }}
                  placeholder="0812345678"
                  className={`input ${pwErrors.phone ? 'input-error' : ''}`} />
                {pwErrors.phone && <p className="field-error">{pwErrors.phone}</p>}
              </div>
              <div>
                <label className="block text-xs text-muted mb-1.5 ml-1">รหัสผ่านใหม่</label>
                <input type="password" value={pwForm.newPassword}
                  onChange={e => { setPwForm(f => ({ ...f, newPassword: e.target.value })); setPwErrors(er => ({ ...er, newPassword: '' })) }}
                  placeholder="อย่างน้อย 6 ตัวอักษร"
                  className={`input ${pwErrors.newPassword ? 'input-error' : ''}`} />
                {pwErrors.newPassword && <p className="field-error">{pwErrors.newPassword}</p>}
              </div>
              {pwResult && (
                <p className="text-sm text-green bg-green/10 rounded-xl px-4 py-2.5">{pwResult}</p>
              )}
              <button type="submit" disabled={pwSaving}
                className={`btn-primary w-full justify-center gap-2 ${pwSaved ? 'bg-green hover:bg-green' : 'bg-yellow hover:bg-yellow/90'}`}
                style={{ boxShadow: '0 6px 16px -6px rgba(217,119,6,.5)' }}>
                {pwSaved     ? <><Check size={16} /> รีเซ็ตแล้ว</>
                 : pwSaving  ? <><Spinner size={16} /> กำลังรีเซ็ต…</>
                 : <><KeyRound size={16} /> รีเซ็ตรหัสผ่าน</>}
              </button>
            </form>
          </div>

          {/* MRR breakdown */}
          {billing && (
            <div className="card p-6">
              <div className="flex items-center gap-2.5 mb-5">
                <TrendingUp size={18} className="text-yellow" />
                <h2 className="font-display font-semibold text-base">รายได้ต่อเดือน (MRR)</h2>
                <span className="ml-auto font-display font-bold text-xl text-accent">฿{billing.revenue.toLocaleString()}</span>
              </div>
              <div className="space-y-3">
                {[
                  { plan: 'free',  label: 'Free',  color: 'bg-bg3 text-muted',       price: '฿0' },
                  { plan: 'basic', label: 'Basic', color: 'bg-blue/10 text-blue',   price: '฿299' },
                  { plan: 'pro',   label: 'Pro',   color: 'bg-accent/10 text-accent', price: '฿799' },
                ].map(p => {
                  const s = billing.summary?.find((s: any) => s.plan === p.plan)
                  const cnt = s?.count ?? 0
                  const rev = cnt * (PLAN_PRICE[p.plan] ?? 0)
                  return (
                    <div key={p.plan} className="flex items-center gap-3">
                      <span className={`text-xs px-2.5 py-1 rounded-lg font-semibold w-14 text-center ${p.color}`}>{p.label}</span>
                      <div className="flex-1 h-2 rounded-full bg-bg3 overflow-hidden">
                        <div className="h-full rounded-full bg-current opacity-40 transition-all"
                          style={{ width: stats.total ? `${(cnt / stats.total) * 100}%` : '0%' }} />
                      </div>
                      <span className="text-xs text-muted w-10 text-right">{cnt} ร้าน</span>
                      <span className="text-xs font-semibold w-20 text-right">{rev > 0 ? `฿${rev.toLocaleString()}` : '—'}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
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
                {rejecting && <Spinner size={14} />} ปฏิเสธ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suspend confirm modal */}
      {suspendTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="card p-6 w-full max-w-sm anim-pop space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose/10 flex items-center justify-center text-rose shrink-0">
                <PowerOff size={18} />
              </div>
              <div>
                <p className="font-display font-bold text-base">ระงับร้าน?</p>
                <p className="text-sm text-muted font-medium">{suspendTarget.name}</p>
              </div>
            </div>
            <div>
              <label className="block text-xs text-muted mb-1.5 ml-1">เหตุผลในการระงับ <span className="text-rose">*</span></label>
              <textarea
                value={suspendReason}
                onChange={e => setSuspendReason(e.target.value)}
                placeholder="เช่น ค้างชำระค่าบริการ, ละเมิดข้อตกลง..."
                rows={3}
                autoFocus
                className={`input resize-none ${suspendSubmitted && !suspendReason.trim() ? 'input-error' : ''}`}
              />
              {suspendSubmitted && !suspendReason.trim() && (
                <p className="field-error">กรุณาระบุเหตุผล</p>
              )}
              <p className="text-xs text-muted mt-1.5 ml-1">เหตุผลนี้จะแสดงให้เจ้าของร้านเห็น</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setSuspendTarget(null); setSuspendReason(''); setSuspendSubmitted(false) }}
                className="btn-secondary flex-1">ยกเลิก</button>
              <button onClick={confirmSuspend}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-rose text-white px-5 py-2.5 rounded-2xl text-sm font-semibold hover:brightness-110 transition-all active:scale-95">
                <PowerOff size={14} /> ระงับร้าน
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logout confirm modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="card p-6 w-full max-w-sm anim-pop space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose/10 flex items-center justify-center text-rose shrink-0">
                <LogOut size={18} />
              </div>
              <div>
                <p className="font-display font-bold text-base">ออกจากระบบ?</p>
                <p className="text-sm text-muted">Session จะถูกยกเลิกทันที</p>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setShowLogoutConfirm(false)}
                className="btn-secondary flex-1">ยกเลิก</button>
              <button onClick={logout}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-rose text-white px-5 py-2.5 rounded-2xl text-sm font-semibold hover:brightness-110 transition-all active:scale-95">
                <LogOut size={14} /> ออกจากระบบ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  return (
    <div className="card p-4 flex items-start gap-3">
      <div className={`mt-0.5 ${color}`}>{icon}</div>
      <div>
        <p className="text-xs text-muted">{label}</p>
        <p className={`font-display font-bold text-xl mt-0.5 ${color}`}>{value}</p>
      </div>
    </div>
  )
}

function NotifItem({ notif }: { notif: any }) {
  const isNew = notif.type === 'NEW_RESTAURANT'
  const time  = notif.ts ? new Date(notif.ts).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : ''
  return (
    <div className="flex items-start gap-3 px-4 py-3 hover:bg-bg3 transition-colors border-b border-border/50 last:border-0">
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${isNew ? 'bg-green/10 text-green' : 'bg-yellow/10 text-yellow'}`}>
        {isNew ? <UserPlus size={14} /> : <CreditCard size={14} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">
          {isNew ? 'ร้านใหม่ลงทะเบียน' : 'คำขออัปเกรดแพ็กเกจ'}
        </p>
        <p className="text-xs text-muted truncate">
          {isNew
            ? notif.restaurant?.name
            : `${notif.restaurant_name} → ${notif.plan} (฿${notif.amount?.toLocaleString()})`}
        </p>
      </div>
      <span className="text-xs text-muted shrink-0">{time}</span>
    </div>
  )
}
