'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { api, getToken, apiFetch } from '@/lib/api'
import { Settings, Save, Check, Lock, Eye, EyeOff, Zap, X, CreditCard, Smartphone, Upload, ChevronRight } from 'lucide-react'
import { LoadingScreen } from '@/components/LoadingScreen'
import { useToast } from '@/components/Toast'

const PLAN_PRICE: Record<string, number> = { free: 0, basic: 299, pro: 799 }
const PLAN_FEATURES: Record<string, string[]> = {
  basic: ['โต๊ะสูงสุด 20 โต๊ะ', 'เมนูสูงสุด 100 รายการ', 'รายงานพื้นฐาน'],
  pro:   ['โต๊ะไม่จำกัด', 'เมนูไม่จำกัด', 'รายงานขั้นสูง', 'ฟีเจอร์ทั้งหมด'],
}

type UpgradeStep = 'plan' | 'method' | 'promptpay' | 'card' | 'done' | 'pending'

export default function SettingsPage() {
  const params = useParams() as { slug: string }
  const [token, setToken] = useState('')
  const [pageLoading, setPageLoading] = useState(true)
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({ name: '', promptpay: '', open_time: '08:00', close_time: '22:00' })
  const [planInfo, setPlanInfo] = useState<any>(null)
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [pwSaving, setPwSaving] = useState(false)
  const [pwSaved, setPwSaved] = useState(false)
  const [showPw, setShowPw] = useState(false)

  // Upgrade modal state
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [upgradeStep, setUpgradeStep] = useState<UpgradeStep>('plan')
  const [selectedPlan, setSelectedPlan] = useState<'basic' | 'pro'>('basic')
  const [platformPromptpay, setPlatformPromptpay] = useState('0812345678')
  const [slipFile, setSlipFile] = useState<File | null>(null)
  const [slipPreview, setSlipPreview] = useState('')
  const [uploading, setUploading] = useState(false)
  const [cardForm, setCardForm] = useState({ number: '', exp: '', cvv: '', name: '' })
  const [paying, setPaying] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const t = getToken()
    setToken(t)
    Promise.all([
      api.get(`/restaurants/${params.slug}`, t),
      api.get('/billing/plans', t).catch(() => ({ promptpay: '0812345678' })),
    ]).then(([r, billing]: any[]) => {
      setForm({ name: r.name ?? '', promptpay: r.promptpay ?? '', open_time: r.open_time ?? '08:00', close_time: r.close_time ?? '22:00' })
      setPlanInfo({ plan: r.plan, table_count: r.table_count, menu_count: r.menu_count, limits: r.plan_limits })
      setPlatformPromptpay(billing?.promptpay ?? '0812345678')
      setPageLoading(false)
    }).catch(() => setPageLoading(false))
  }, [])

  function openUpgrade() {
    const next = planInfo?.plan === 'free' ? 'basic' : 'pro'
    setSelectedPlan(next as any)
    setUpgradeStep('plan')
    setSlipFile(null)
    setSlipPreview('')
    setCardForm({ number: '', exp: '', cvv: '', name: '' })
    setShowUpgrade(true)
  }

  function closeUpgrade() {
    if (paying || uploading) return
    setShowUpgrade(false)
  }

  function onSlipChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setSlipFile(file)
    setSlipPreview(URL.createObjectURL(file))
  }

  async function submitPromptpay() {
    if (!slipFile) { toast.error('กรุณาแนบสลิปโอนเงิน'); return }
    setUploading(true)
    try {
      const form = new FormData()
      form.append('slip', slipFile)
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/billing/slip`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
        credentials: 'include',
      })
      if (!res.ok) throw new Error('อัปโหลดสลิปไม่สำเร็จ')
      const { url } = await res.json()
      await api.post('/billing/upgrade', { plan: selectedPlan, method: 'promptpay', slip_url: url }, token)
      setUpgradeStep('pending')
    } catch (e: any) {
      toast.error(e.message ?? 'เกิดข้อผิดพลาด')
    } finally {
      setUploading(false)
    }
  }

  async function submitCard() {
    if (!cardForm.number || !cardForm.exp || !cardForm.cvv || !cardForm.name) {
      toast.error('กรุณากรอกข้อมูลบัตรให้ครบ')
      return
    }
    setPaying(true)
    try {
      await new Promise(r => setTimeout(r, 1500))
      const res = await api.post('/billing/upgrade', { plan: selectedPlan, method: 'card' }, token)
      if (res.upgraded) {
        setPlanInfo((p: any) => ({ ...p, plan: selectedPlan, limits: { basic: { tables: 20, menus: 100 }, pro: { tables: Infinity, menus: Infinity } }[selectedPlan] }))
        setUpgradeStep('done')
      }
    } catch (e: any) {
      toast.error(e.message ?? 'ชำระเงินไม่สำเร็จ')
    } finally {
      setPaying(false)
    }
  }

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

  const canUpgrade = planInfo && planInfo.plan !== 'pro'
  const upgradablePlans = planInfo?.plan === 'free' ? ['basic', 'pro'] : ['pro']

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

      {/* Plan info */}
      {planInfo && (
        <div className="card p-5 mb-5 anim-up" style={{ animationDelay: '20ms' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-accent" />
              <span className="font-semibold text-sm text-text">แพ็กเกจปัจจุบัน</span>
            </div>
            <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase ${
              planInfo.plan === 'pro'   ? 'bg-accent/15 text-accent' :
              planInfo.plan === 'basic' ? 'bg-blue/15 text-blue' :
                                          'bg-bg3 text-muted'
            }`}>{planInfo.plan}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { label: 'โต๊ะ', used: planInfo.table_count, max: planInfo.limits?.tables },
              { label: 'เมนู', used: planInfo.menu_count,  max: planInfo.limits?.menus  },
            ].map(item => {
              const isUnlimited = item.max === null || item.max === undefined || !isFinite(item.max)
              const pct = isUnlimited ? 0 : Math.min((item.used / item.max) * 100, 100)
              const isNear = !isUnlimited && pct >= 80
              return (
                <div key={item.label} className="bg-bg3 rounded-xl p-3">
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-muted">{item.label}</span>
                    <span className={`font-semibold ${isNear ? 'text-rose' : 'text-text'}`}>
                      {item.used} / {isUnlimited ? '∞' : item.max}
                    </span>
                  </div>
                  {!isUnlimited && (
                    <div className="h-1.5 bg-border rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${isNear ? 'bg-rose' : 'bg-accent'}`} style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          {canUpgrade ? (
            <button onClick={openUpgrade}
              className="btn-primary w-full justify-center gap-2 text-sm">
              <Zap size={15} /> อัปเกรดแพ็กเกจ
            </button>
          ) : (
            <p className="text-xs text-muted text-center">คุณใช้แพ็กเกจ Pro แล้ว</p>
          )}
        </div>
      )}

      <form onSubmit={submit} className="card p-6 space-y-5 anim-up" style={{ animationDelay: '40ms' }}>
        <div>
          <label className="block text-xs font-medium text-muted mb-1.5 ml-1">ชื่อร้าน <span className="text-rose">*</span></label>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="ร้านอาหารของฉัน" className="input" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1.5 ml-1">เลข PromptPay</label>
          <input value={form.promptpay} onChange={e => setForm(f => ({ ...f, promptpay: e.target.value }))} placeholder="0812345678 หรือเลขประจำตัว 13 หลัก" className="input" />
          <p className="text-xs text-muted/60 mt-1 ml-1">ใช้สำหรับรับชำระเงินผ่าน QR code</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1.5 ml-1">เวลาทำการ</label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted mb-1 ml-1">เปิด</p>
              <input type="time" value={form.open_time} onChange={e => setForm(f => ({ ...f, open_time: e.target.value }))} className="input" />
            </div>
            <div>
              <p className="text-xs text-muted mb-1 ml-1">ปิด</p>
              <input type="time" value={form.close_time} onChange={e => setForm(f => ({ ...f, close_time: e.target.value }))} className="input" />
            </div>
          </div>
        </div>
        <button type="submit" disabled={saving || !form.name.trim()}
          className={`btn-primary w-full justify-center gap-2 transition-all ${saved ? 'bg-green hover:bg-green' : ''}`}>
          {saved ? <><Check size={16} /> บันทึกแล้ว</>
            : saving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> กำลังบันทึก...</>
            : <><Save size={16} /> บันทึก</>}
        </button>
      </form>

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
            <input type={showPw ? 'text' : 'password'} value={(pwForm as any)[key]}
              onChange={e => setPwForm(f => ({ ...f, [key]: e.target.value }))} placeholder="••••••••" className="input pr-11" />
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

      {/* Upgrade Modal */}
      {showUpgrade && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={closeUpgrade}>
          <div className="bg-bg2 rounded-3xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-2.5">
                <Zap size={18} className="text-accent" />
                <span className="font-display font-bold text-lg">อัปเกรดแพ็กเกจ</span>
              </div>
              <button onClick={closeUpgrade} className="w-8 h-8 rounded-xl bg-bg3 flex items-center justify-center text-muted hover:text-text transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="p-5">
              {/* Step: select plan */}
              {upgradeStep === 'plan' && (
                <div className="space-y-3">
                  <p className="text-sm text-muted mb-4">เลือกแพ็กเกจที่ต้องการอัปเกรด</p>
                  {upgradablePlans.map(plan => (
                    <button key={plan} onClick={() => setSelectedPlan(plan as any)}
                      className={`w-full p-4 rounded-2xl border-2 text-left transition-all ${
                        selectedPlan === plan ? 'border-accent bg-accent/5' : 'border-border bg-bg3 hover:border-border/80'
                      }`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`font-bold uppercase text-sm ${plan === 'pro' ? 'text-accent' : 'text-blue'}`}>{plan}</span>
                        <span className="font-display font-bold text-lg">฿{PLAN_PRICE[plan]}<span className="text-xs text-muted font-normal">/เดือน</span></span>
                      </div>
                      <ul className="space-y-1">
                        {PLAN_FEATURES[plan].map(f => (
                          <li key={f} className="text-xs text-muted flex items-center gap-1.5">
                            <Check size={12} className="text-green shrink-0" /> {f}
                          </li>
                        ))}
                      </ul>
                    </button>
                  ))}
                  <button onClick={() => setUpgradeStep('method')}
                    className="btn-primary w-full justify-center gap-2 mt-2">
                    ถัดไป <ChevronRight size={16} />
                  </button>
                </div>
              )}

              {/* Step: select payment method */}
              {upgradeStep === 'method' && (
                <div className="space-y-3">
                  <p className="text-sm text-muted mb-4">เลือกวิธีชำระเงิน — {selectedPlan.toUpperCase()} ฿{PLAN_PRICE[selectedPlan]}/เดือน</p>
                  <button onClick={() => setUpgradeStep('promptpay')}
                    className="w-full p-4 rounded-2xl border-2 border-border bg-bg3 hover:border-accent/40 transition-all flex items-center gap-3 text-left">
                    <div className="w-10 h-10 rounded-xl bg-blue/10 flex items-center justify-center shrink-0">
                      <Smartphone size={20} className="text-blue" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">PromptPay</p>
                      <p className="text-xs text-muted">โอนเงินแล้วแนบสลิป — ทีมตรวจสอบภายใน 24 ชม.</p>
                    </div>
                  </button>
                  <button onClick={() => setUpgradeStep('card')}
                    className="w-full p-4 rounded-2xl border-2 border-border bg-bg3 hover:border-accent/40 transition-all flex items-center gap-3 text-left">
                    <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                      <CreditCard size={20} className="text-accent" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">บัตรเครดิต / เดบิต</p>
                      <p className="text-xs text-muted">อัปเกรดทันที — Visa, Mastercard</p>
                    </div>
                  </button>
                  <button onClick={() => setUpgradeStep('plan')}
                    className="w-full text-sm text-muted hover:text-text transition-colors py-2">
                    ย้อนกลับ
                  </button>
                </div>
              )}

              {/* Step: PromptPay */}
              {upgradeStep === 'promptpay' && (
                <div className="space-y-4">
                  <div className="bg-blue/5 border border-blue/20 rounded-2xl p-4">
                    <p className="text-xs text-muted mb-1">โอนเงินจำนวน</p>
                    <p className="font-display font-bold text-2xl text-blue">฿{PLAN_PRICE[selectedPlan].toLocaleString()}</p>
                    <p className="text-xs text-muted mt-2">ไปยัง PromptPay</p>
                    <p className="font-mono font-bold text-lg text-text mt-0.5">{platformPromptpay}</p>
                    <p className="text-xs text-muted mt-2">หมายเหตุการโอน: <span className="text-text font-medium">upgrade-{selectedPlan}</span></p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted mb-2">แนบสลิปการโอนเงิน <span className="text-rose">*</span></label>
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onSlipChange} />
                    {slipPreview ? (
                      <div className="relative">
                        <img src={slipPreview} alt="slip" className="w-full h-48 object-contain rounded-xl border border-border bg-bg3" />
                        <button onClick={() => { setSlipFile(null); setSlipPreview('') }}
                          className="absolute top-2 right-2 w-7 h-7 bg-rose/90 rounded-lg flex items-center justify-center text-white">
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => fileRef.current?.click()}
                        className="w-full h-28 rounded-xl border-2 border-dashed border-border bg-bg3 hover:border-accent/50 transition-all flex flex-col items-center justify-center gap-2 text-muted hover:text-text">
                        <Upload size={22} />
                        <span className="text-xs">แตะเพื่อเลือกรูปสลิป</span>
                      </button>
                    )}
                  </div>
                  <button onClick={submitPromptpay} disabled={uploading || !slipFile}
                    className="btn-primary w-full justify-center gap-2">
                    {uploading
                      ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> กำลังส่ง...</>
                      : 'ส่งสลิปเพื่อตรวจสอบ'}
                  </button>
                  <button onClick={() => setUpgradeStep('method')} disabled={uploading}
                    className="w-full text-sm text-muted hover:text-text transition-colors py-1">
                    ย้อนกลับ
                  </button>
                </div>
              )}

              {/* Step: Card */}
              {upgradeStep === 'card' && (
                <div className="space-y-4">
                  <div className="bg-bg3 rounded-2xl p-4">
                    <p className="text-xs text-muted">ยอดชำระ</p>
                    <p className="font-display font-bold text-xl text-accent">฿{PLAN_PRICE[selectedPlan].toLocaleString()}/เดือน</p>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-muted mb-1.5 ml-1">ชื่อบนบัตร</label>
                      <input value={cardForm.name} onChange={e => setCardForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="SOMCHAI JAIDEE" className="input" />
                    </div>
                    <div>
                      <label className="block text-xs text-muted mb-1.5 ml-1">หมายเลขบัตร</label>
                      <input value={cardForm.number} onChange={e => {
                        const v = e.target.value.replace(/\D/g, '').slice(0, 16)
                        setCardForm(f => ({ ...f, number: v.replace(/(.{4})/g, '$1 ').trim() }))
                      }} placeholder="0000 0000 0000 0000" className="input font-mono" maxLength={19} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-muted mb-1.5 ml-1">วันหมดอายุ</label>
                        <input value={cardForm.exp} onChange={e => {
                          const v = e.target.value.replace(/\D/g, '').slice(0, 4)
                          setCardForm(f => ({ ...f, exp: v.length > 2 ? `${v.slice(0,2)}/${v.slice(2)}` : v }))
                        }} placeholder="MM/YY" className="input font-mono" maxLength={5} />
                      </div>
                      <div>
                        <label className="block text-xs text-muted mb-1.5 ml-1">CVV</label>
                        <input value={cardForm.cvv} onChange={e => setCardForm(f => ({ ...f, cvv: e.target.value.replace(/\D/g, '').slice(0, 3) }))}
                          placeholder="123" className="input font-mono" maxLength={3} type="password" />
                      </div>
                    </div>
                  </div>
                  <button onClick={submitCard} disabled={paying}
                    className="btn-primary w-full justify-center gap-2">
                    {paying
                      ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> กำลังประมวลผล...</>
                      : <><CreditCard size={16} /> ชำระเงิน ฿{PLAN_PRICE[selectedPlan].toLocaleString()}</>}
                  </button>
                  <button onClick={() => setUpgradeStep('method')} disabled={paying}
                    className="w-full text-sm text-muted hover:text-text transition-colors py-1">
                    ย้อนกลับ
                  </button>
                </div>
              )}

              {/* Done — card approved */}
              {upgradeStep === 'done' && (
                <div className="text-center py-6 space-y-4">
                  <div className="w-16 h-16 rounded-full bg-green/10 flex items-center justify-center mx-auto">
                    <Check size={32} className="text-green" />
                  </div>
                  <div>
                    <p className="font-display font-bold text-xl">อัปเกรดสำเร็จ!</p>
                    <p className="text-muted text-sm mt-1">แพ็กเกจของคุณเปลี่ยนเป็น <span className="font-bold text-text uppercase">{selectedPlan}</span> แล้ว</p>
                  </div>
                  <button onClick={() => { setShowUpgrade(false); window.location.reload() }}
                    className="btn-primary px-8 justify-center">
                    เสร็จสิ้น
                  </button>
                </div>
              )}

              {/* Pending — PromptPay awaiting approval */}
              {upgradeStep === 'pending' && (
                <div className="text-center py-6 space-y-4">
                  <div className="w-16 h-16 rounded-full bg-yellow/10 flex items-center justify-center mx-auto">
                    <Smartphone size={32} className="text-yellow" />
                  </div>
                  <div>
                    <p className="font-display font-bold text-xl">รอการตรวจสอบ</p>
                    <p className="text-muted text-sm mt-1 max-w-xs mx-auto">ทีมงานจะตรวจสอบสลิปและอัปเกรดแพ็กเกจของคุณภายใน 24 ชั่วโมง</p>
                  </div>
                  <button onClick={() => setShowUpgrade(false)}
                    className="btn-primary px-8 justify-center">
                    รับทราบ
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
