'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { api, getToken } from '@/lib/api'
import {
  Settings, Save, Check, Lock, Eye, EyeOff, Zap, X,
  CreditCard, Smartphone, Upload, ChevronRight, Store,
  Clock, Hash, Shield, ChevronUp, Mail,
} from 'lucide-react'
import { LoadingScreen } from '@/components/LoadingScreen'
import { useToast } from '@/components/Toast'
import { Spinner } from '@/components/Spinner'
import { cn } from '@/lib/cn'

const PLAN_PRICE: Record<string, number> = { free: 0, basic: 299, pro: 799 }
const PLAN_FEATURES: Record<string, string[]> = {
  basic: ['โต๊ะสูงสุด 20 โต๊ะ', 'เมนูสูงสุด 100 รายการ', 'รายงานพื้นฐาน'],
  pro:   ['โต๊ะไม่จำกัด', 'เมนูไม่จำกัด', 'รายงานขั้นสูง', 'ฟีเจอร์ทั้งหมด'],
}
const PLAN_COLOR: Record<string, string> = {
  free:  'bg-bg3 text-muted',
  basic: 'bg-blue/10 text-blue',
  pro:   'bg-accent/10 text-accent',
}

type UpgradeStep = 'plan' | 'method' | 'promptpay' | 'card' | 'done' | 'pending'

export default function SettingsPage() {
  const { slug } = useParams() as { slug: string }
  const [token, setToken] = useState('')
  const [pageLoading, setPageLoading] = useState(true)
  const toast = useToast()

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({ name: '', promptpay: '', open_time: '08:00', close_time: '22:00', contact_email: '' })
  const [planInfo, setPlanInfo] = useState<any>(null)

  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [pwSaving, setPwSaving] = useState(false)
  const [pwSaved, setPwSaved] = useState(false)
  const [showPw, setShowPw] = useState<Record<string, boolean>>({})

  // Upgrade modal
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
      api.get(`/restaurants/${slug}`, t),
      api.get('/billing/plans', t).catch(() => ({ promptpay: '0812345678' })),
    ]).then(([r, billing]: any[]) => {
      setForm({ name: r.name ?? '', promptpay: r.promptpay ?? '', open_time: r.open_time ?? '08:00', close_time: r.close_time ?? '22:00', contact_email: r.contact_email ?? '' })
      setPlanInfo({ plan: r.plan, table_count: r.table_count, menu_count: r.menu_count, limits: r.plan_limits })
      setPlatformPromptpay(billing?.promptpay ?? '0812345678')
      setPageLoading(false)
    }).catch(() => setPageLoading(false))
  }, [])

  function openUpgrade() {
    setSelectedPlan(planInfo?.plan === 'free' ? 'basic' : 'pro')
    setUpgradeStep('plan')
    setSlipFile(null); setSlipPreview('')
    setCardForm({ number: '', exp: '', cvv: '', name: '' })
    setShowUpgrade(true)
  }

  function onSlipChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setSlipFile(file); setSlipPreview(URL.createObjectURL(file))
  }

  async function submitPromptpay() {
    if (!slipFile) { toast.error('กรุณาแนบสลิปโอนเงิน'); return }
    setUploading(true)
    try {
      const fd = new FormData(); fd.append('slip', slipFile)
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/billing/slip`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
      })
      if (!res.ok) throw new Error('อัปโหลดสลิปไม่สำเร็จ')
      const { url } = await res.json()
      await api.post('/billing/upgrade', { plan: selectedPlan, method: 'promptpay', slip_url: url }, token)
      setUpgradeStep('pending')
    } catch (e: any) { toast.error(e.message ?? 'เกิดข้อผิดพลาด') }
    finally { setUploading(false) }
  }

  async function submitCard() {
    if (!cardForm.number || !cardForm.exp || !cardForm.cvv || !cardForm.name) {
      toast.error('กรุณากรอกข้อมูลบัตรให้ครบ'); return
    }
    setPaying(true)
    try {
      await new Promise(r => setTimeout(r, 1500))
      const res = await api.post('/billing/upgrade', { plan: selectedPlan, method: 'card' }, token)
      if (res.upgraded) {
        setPlanInfo((p: any) => ({ ...p, plan: selectedPlan }))
        setUpgradeStep('done')
      }
    } catch (e: any) { toast.error(e.message ?? 'ชำระเงินไม่สำเร็จ') }
    finally { setPaying(false) }
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
        contact_email: form.contact_email.trim() || undefined,
      }, token)
      setSaved(true); toast.success('บันทึกข้อมูลร้านเรียบร้อยแล้ว')
      setTimeout(() => setSaved(false), 2500)
    } catch (err: any) { toast.error(err.message ?? 'บันทึกไม่สำเร็จ') }
    finally { setSaving(false) }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    if (pwForm.next.length < 6) { toast.error('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร'); return }
    if (pwForm.next !== pwForm.confirm) { toast.error('รหัสผ่านใหม่ไม่ตรงกัน'); return }
    setPwSaving(true)
    try {
      await api.patch('/auth/change-password', { currentPassword: pwForm.current, newPassword: pwForm.next }, token)
      setPwSaved(true); setPwForm({ current: '', next: '', confirm: '' })
      toast.success('เปลี่ยนรหัสผ่านเรียบร้อยแล้ว')
      setTimeout(() => setPwSaved(false), 2500)
    } catch (err: any) { toast.error(err.message ?? 'เปลี่ยนรหัสผ่านไม่สำเร็จ') }
    finally { setPwSaving(false) }
  }

  if (pageLoading) return <LoadingScreen />

  const canUpgrade = planInfo && planInfo.plan !== 'pro'
  const upgradablePlans = planInfo?.plan === 'free' ? ['basic', 'pro'] : ['pro']

  return (
    <div className="p-5 md:p-8 max-w-2xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div className="anim-up">
        <h1 className="font-display font-bold text-2xl text-text text-balance">ตั้งค่า</h1>
        <p className="text-muted text-sm mt-0.5">จัดการข้อมูลร้านและการใช้งาน</p>
      </div>

      {/* ── แพ็กเกจ ── */}
      {planInfo && (
        <section className="anim-up" style={{ animationDelay: '20ms' }}>
          <SectionLabel icon={<Zap size={14} />} label="แพ็กเกจ" />
          <div className="card overflow-hidden">
            {/* plan badge row */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <p className="text-xs text-muted mb-0.5">แพ็กเกจปัจจุบัน</p>
                <p className="font-display font-bold text-lg text-text capitalize">{planInfo.plan}</p>
              </div>
              <span className={`text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wide ${PLAN_COLOR[planInfo.plan]}`}>
                {planInfo.plan}
              </span>
            </div>

            {/* usage bars */}
            <div className="grid grid-cols-2 divide-x divide-border">
              {[
                { label: 'โต๊ะที่ใช้', used: planInfo.table_count, max: planInfo.limits?.tables },
                { label: 'เมนูที่ใช้',  used: planInfo.menu_count,  max: planInfo.limits?.menus  },
              ].map(item => {
                const unlimited = item.max == null || !isFinite(item.max)
                const pct = unlimited ? 0 : Math.min((item.used / item.max) * 100, 100)
                const near = !unlimited && pct >= 80
                return (
                  <div key={item.label} className="px-5 py-4">
                    <div className="flex items-end justify-between mb-2">
                      <p className="text-xs text-muted">{item.label}</p>
                      <p className={`text-sm font-bold ${near ? 'text-rose' : 'text-text'}`}>
                        {item.used}<span className="text-muted font-normal text-xs"> / {unlimited ? '∞' : item.max}</span>
                      </p>
                    </div>
                    <div className="h-1.5 bg-border rounded-full overflow-hidden">
                      {!unlimited && (
                        <div className={`h-full rounded-full transition-all duration-500 ${near ? 'bg-rose' : 'bg-accent'}`}
                          style={{ width: `${pct}%` }} />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* upgrade button */}
            <div className="px-5 pb-5">
              {canUpgrade ? (
                <button onClick={openUpgrade}
                  className="btn-primary w-full justify-center gap-2 text-sm">
                  <ChevronUp size={15} /> อัปเกรดแพ็กเกจ
                </button>
              ) : (
                <div className="flex items-center justify-center gap-2 py-2 text-sm text-accent font-medium">
                  <Check size={15} /> คุณใช้แพ็กเกจสูงสุดแล้ว
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── ข้อมูลร้าน ── */}
      <section className="anim-up" style={{ animationDelay: '60ms' }}>
        <SectionLabel icon={<Store size={14} />} label="ข้อมูลร้าน" />
        <form onSubmit={submit} className="card p-5 space-y-4">
          <Field label="ชื่อร้าน" required>
            <input value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="ร้านอาหารของฉัน" className="input" />
          </Field>

          <Field label="เลข PromptPay" hint="ใช้รับชำระเงินจากลูกค้าผ่าน QR code">
            <div className="relative">
              <Hash size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              <input value={form.promptpay}
                onChange={e => setForm(f => ({ ...f, promptpay: e.target.value }))}
                placeholder="0812345678" className="input pl-9" />
            </div>
          </Field>

          <Field label="อีเมลติดต่อ" hint="รับการแจ้งเตือนจากระบบ เช่น การอัปเกรดแพ็กเกจ, แจ้งเตือนหมดอายุ">
            <div className="relative">
              <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              <input type="email" value={form.contact_email}
                onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))}
                placeholder="manager@restaurant.com" className="input pl-9" />
            </div>
          </Field>

          <Field label="เวลาทำการ">
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'open_time',  label: 'เปิด' },
                { key: 'close_time', label: 'ปิด'  },
              ].map(({ key, label }) => (
                <div key={key}>
                  <p className="text-xs text-muted mb-1.5 flex items-center gap-1">
                    <Clock size={11} />{label}
                  </p>
                  <input type="time" value={(form as any)[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="input" />
                </div>
              ))}
            </div>
          </Field>

          <button type="submit" disabled={saving || !form.name.trim()}
            className={`btn-primary w-full justify-center gap-2 transition-all ${saved ? '!bg-green' : ''}`}>
            {saved    ? <><Check size={16} /> บันทึกแล้ว</>
             : saving ? <><Spinner /> กำลังบันทึก...</>
             :           <><Save size={16} /> บันทึกข้อมูลร้าน</>}
          </button>
        </form>
      </section>

      {/* ── ความปลอดภัย ── */}
      <section className="anim-up" style={{ animationDelay: '100ms' }}>
        <SectionLabel icon={<Shield size={14} />} label="ความปลอดภัย" />
        <form onSubmit={changePassword} className="card p-5 space-y-4">
          {([
            { key: 'current', label: 'รหัสผ่านปัจจุบัน' },
            { key: 'next',    label: 'รหัสผ่านใหม่',     hint: 'อย่างน้อย 6 ตัวอักษร' },
            { key: 'confirm', label: 'ยืนยันรหัสผ่านใหม่' },
          ] as { key: string; label: string; hint?: string }[]).map(({ key, label, hint }) => (
            <Field key={key} label={label} hint={hint}>
              <div className="relative">
                <input type={showPw[key] ? 'text' : 'password'}
                  value={(pwForm as any)[key]}
                  onChange={e => setPwForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder="••••••••" className="input pr-11" />
                <button type="button"
                  onClick={() => setShowPw(v => ({ ...v, [key]: !v[key] }))}
                  aria-label={showPw[key] ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted hover:text-text transition-colors">
                  {showPw[key] ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </Field>
          ))}

          <button type="submit"
            disabled={pwSaving || !pwForm.current || !pwForm.next || !pwForm.confirm}
            className={`btn-primary w-full justify-center gap-2 transition-all ${pwSaved ? '!bg-green' : ''}`}>
            {pwSaved    ? <><Check size={16} /> เปลี่ยนแล้ว</>
             : pwSaving ? <><Spinner /> กำลังเปลี่ยน...</>
             :             <><Lock size={16} /> เปลี่ยนรหัสผ่าน</>}
          </button>
        </form>
      </section>

      {/* ── Upgrade Modal ── */}
      {showUpgrade && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-modal flex items-end sm:items-center justify-center p-4"
          onClick={() => { if (!paying && !uploading) setShowUpgrade(false) }}>
          <div className="bg-bg2 rounded-3xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <Zap size={18} className="text-accent" />
                <span className="font-display font-bold text-lg">อัปเกรดแพ็กเกจ</span>
              </div>
              <button onClick={() => { if (!paying && !uploading) setShowUpgrade(false) }}
                aria-label="ปิด"
              className="size-8 rounded-xl bg-bg3 flex items-center justify-center text-muted hover:text-text transition-colors">
                <X size={15} />
              </button>
            </div>

            <div className="p-5">
              {upgradeStep === 'plan' && (
                <div className="space-y-3">
                  <p className="text-sm text-muted">เลือกแพ็กเกจที่ต้องการ</p>
                  {upgradablePlans.map(plan => (
                    <button key={plan} onClick={() => setSelectedPlan(plan as any)}
                      className={`w-full p-4 rounded-2xl border-2 text-left transition-all ${
                        selectedPlan === plan ? 'border-accent bg-accent/5' : 'border-border bg-bg3 hover:border-accent/30'
                      }`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`font-bold uppercase text-sm ${plan === 'pro' ? 'text-accent' : 'text-blue'}`}>{plan}</span>
                        <span className="font-display font-bold text-lg">
                          ฿{PLAN_PRICE[plan]}<span className="text-xs text-muted font-normal">/เดือน</span>
                        </span>
                      </div>
                      <ul className="space-y-1">
                        {PLAN_FEATURES[plan].map(f => (
                          <li key={f} className="text-xs text-muted flex items-center gap-1.5">
                            <Check size={11} className="text-green shrink-0" />{f}
                          </li>
                        ))}
                      </ul>
                    </button>
                  ))}
                  <button onClick={() => setUpgradeStep('method')} className="btn-primary w-full justify-center gap-1.5 mt-1">
                    ถัดไป <ChevronRight size={15} />
                  </button>
                </div>
              )}

              {upgradeStep === 'method' && (
                <div className="space-y-3">
                  <p className="text-sm text-muted mb-1">
                    <span className="font-semibold text-text uppercase">{selectedPlan}</span>
                    {' '}— ฿{PLAN_PRICE[selectedPlan].toLocaleString()}/เดือน
                  </p>
                  {[
                    { key: 'promptpay', icon: <Smartphone size={20} className="text-blue" />, bg: 'bg-blue/10',
                      title: 'PromptPay', sub: 'โอนแล้วแนบสลิป — อนุมัติภายใน 24 ชม.' },
                    { key: 'card',      icon: <CreditCard size={20} className="text-accent" />, bg: 'bg-accent/10',
                      title: 'บัตรเครดิต / เดบิต', sub: 'อัปเกรดทันที — Visa, Mastercard' },
                  ].map(m => (
                    <button key={m.key} onClick={() => setUpgradeStep(m.key as any)}
                      className="w-full p-4 rounded-2xl border-2 border-border bg-bg3 hover:border-accent/30 transition-all flex items-center gap-3 text-left">
                      <div className={cn('size-10 rounded-xl flex items-center justify-center shrink-0', m.bg)}>{m.icon}</div>
                      <div>
                        <p className="font-semibold text-sm">{m.title}</p>
                        <p className="text-xs text-muted">{m.sub}</p>
                      </div>
                    </button>
                  ))}
                  <BackBtn onClick={() => setUpgradeStep('plan')} />
                </div>
              )}

              {upgradeStep === 'promptpay' && (
                <div className="space-y-4">
                  <div className="bg-blue/5 border border-blue/20 rounded-2xl p-4 space-y-1.5">
                    <p className="text-xs text-muted">โอนเงินจำนวน</p>
                    <p className="font-display font-bold text-2xl text-blue">฿{PLAN_PRICE[selectedPlan].toLocaleString()}</p>
                    <div className="pt-1 border-t border-blue/10">
                      <p className="text-xs text-muted">ไปยัง PromptPay</p>
                      <p className="font-mono font-bold text-lg text-text">{platformPromptpay}</p>
                      <p className="text-xs text-muted mt-1">หมายเหตุ: <span className="text-text font-medium">upgrade-{selectedPlan}</span></p>
                    </div>
                  </div>
                  <Field label="แนบสลิปการโอน" required>
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onSlipChange} />
                    {slipPreview ? (
                      <div className="relative">
                        <img src={slipPreview} alt="slip" className="w-full h-48 object-contain rounded-xl border border-border bg-bg3" />
                        <button onClick={() => { setSlipFile(null); setSlipPreview('') }}
                          aria-label="ลบสลิป" data-tooltip="ลบสลิป" className="absolute top-2 right-2 size-7 bg-rose/90 rounded-lg flex items-center justify-center text-white">
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => fileRef.current?.click()}
                        className="w-full h-28 rounded-xl border-2 border-dashed border-border bg-bg3 hover:border-accent/50 transition-all flex flex-col items-center justify-center gap-2 text-muted hover:text-text">
                        <Upload size={20} /><span className="text-xs">แตะเพื่อเลือกรูปสลิป</span>
                      </button>
                    )}
                  </Field>
                  <button onClick={submitPromptpay} disabled={uploading || !slipFile} className="btn-primary w-full justify-center gap-2">
                    {uploading ? <><Spinner />กำลังส่ง...</> : 'ส่งสลิปเพื่อตรวจสอบ'}
                  </button>
                  <BackBtn onClick={() => setUpgradeStep('method')} disabled={uploading} />
                </div>
              )}

              {upgradeStep === 'card' && (
                <div className="space-y-4">
                  <div className="bg-bg3 rounded-2xl px-4 py-3 flex items-center justify-between">
                    <p className="text-sm text-muted">ยอดชำระ</p>
                    <p className="font-display font-bold text-lg text-accent">฿{PLAN_PRICE[selectedPlan].toLocaleString()}<span className="text-xs text-muted font-normal">/เดือน</span></p>
                  </div>
                  <div className="space-y-3">
                    <Field label="ชื่อบนบัตร">
                      <input value={cardForm.name} onChange={e => setCardForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="SOMCHAI JAIDEE" className="input" />
                    </Field>
                    <Field label="หมายเลขบัตร">
                      <input value={cardForm.number} onChange={e => {
                        const v = e.target.value.replace(/\D/g, '').slice(0, 16)
                        setCardForm(f => ({ ...f, number: v.replace(/(.{4})/g, '$1 ').trim() }))
                      }} placeholder="0000 0000 0000 0000" className="input font-mono tracking-wider" maxLength={19} />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="วันหมดอายุ">
                        <input value={cardForm.exp} onChange={e => {
                          const v = e.target.value.replace(/\D/g, '').slice(0, 4)
                          setCardForm(f => ({ ...f, exp: v.length > 2 ? `${v.slice(0, 2)}/${v.slice(2)}` : v }))
                        }} placeholder="MM/YY" className="input font-mono" maxLength={5} />
                      </Field>
                      <Field label="CVV">
                        <input value={cardForm.cvv} onChange={e => setCardForm(f => ({ ...f, cvv: e.target.value.replace(/\D/g, '').slice(0, 3) }))}
                          placeholder="123" className="input font-mono" maxLength={3} type="password" />
                      </Field>
                    </div>
                  </div>
                  <button onClick={submitCard} disabled={paying} className="btn-primary w-full justify-center gap-2">
                    {paying ? <><Spinner />กำลังประมวลผล...</> : <><CreditCard size={15} />ชำระ ฿{PLAN_PRICE[selectedPlan].toLocaleString()}</>}
                  </button>
                  <BackBtn onClick={() => setUpgradeStep('method')} disabled={paying} />
                </div>
              )}

              {upgradeStep === 'done' && (
                <div className="text-center py-6 space-y-4">
                  <div className="size-16 rounded-full bg-green/10 flex items-center justify-center mx-auto">
                    <Check size={30} className="text-green" />
                  </div>
                  <div>
                    <p className="font-display font-bold text-xl">อัปเกรดสำเร็จ!</p>
                    <p className="text-muted text-sm mt-1">แพ็กเกจของคุณเปลี่ยนเป็น <span className="font-bold text-text uppercase">{selectedPlan}</span> แล้ว</p>
                  </div>
                  <button onClick={() => { setShowUpgrade(false); window.location.reload() }} className="btn-primary px-8 justify-center">เสร็จสิ้น</button>
                </div>
              )}

              {upgradeStep === 'pending' && (
                <div className="text-center py-6 space-y-4">
                  <div className="size-16 rounded-full bg-yellow/10 flex items-center justify-center mx-auto">
                    <Smartphone size={30} className="text-yellow" />
                  </div>
                  <div>
                    <p className="font-display font-bold text-xl">รอการตรวจสอบ</p>
                    <p className="text-muted text-sm mt-1 max-w-xs mx-auto">ทีมงานจะตรวจสอบสลิปและอัปเกรดแพ็กเกจภายใน 24 ชั่วโมง</p>
                  </div>
                  <button onClick={() => setShowUpgrade(false)} className="btn-primary px-8 justify-center">รับทราบ</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── tiny shared components ────────────────────────────────────────────────
function SectionLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-bold text-muted uppercase tracking-wider mb-2 px-1">
      {icon}{label}
    </div>
  )
}

function Field({ label, hint, required, children }: {
  label: string; hint?: string; required?: boolean; children: React.ReactNode
}) {
  return (
    <div>
      <label className="flex items-center gap-1 text-xs font-medium text-muted mb-1.5 ml-0.5">
        {label}{required && <span className="text-rose">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-muted/60 mt-1 ml-0.5">{hint}</p>}
    </div>
  )
}

function BackBtn({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="w-full text-sm text-muted hover:text-text transition-colors py-1 disabled:opacity-40">
      ย้อนกลับ
    </button>
  )
}

