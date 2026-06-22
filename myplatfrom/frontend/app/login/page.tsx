'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, saveToken } from '@/lib/api'
import { Mail, Lock, ArrowRight, Eye, EyeOff } from 'lucide-react'
import { Spinner } from '@/components/Spinner'
import { cn } from '@/lib/cn'

export default function LoginPage() {
  const router = useRouter()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [unverified, setUnverified] = useState(false)
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [showPw, setShowPw] = useState(false)

  async function resendVerification() {
    setResending(true)
    try {
      await api.post('/auth/resend-verification', { email: form.email })
      setResent(true)
    } catch {} finally { setResending(false) }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (!form.email || !form.password || form.password.length < 6) return
    setError(''); setUnverified(false); setResent(false); setLoading(true)
    try {
      const data = await api.post('/auth/login', form)
      saveToken(data.token)
      const { role, restaurantSlug } = data.user
      const base = `/dashboard/${restaurantSlug}`
      if (role === 'super_admin') window.location.href = '/admin'
      else if (role === 'manager') window.location.href = base
      else if (role === 'chef') window.location.href = `${base}/kitchen`
      else if (role === 'employee') window.location.href = `${base}/orders`
      else window.location.href = '/'
    } catch (err: any) {
      if (err.message === 'email_unverified') { setUnverified(true) }
      else setError(err.message)
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left brand panel */}
      <div className="hidden lg:flex w-1/2 relative overflow-hidden bg-accent flex-col items-center justify-center p-12 text-white">
        <div className="absolute top-12 left-16 text-6xl floaty opacity-90">🍜</div>
        <div className="absolute top-1/3 right-20 text-5xl floaty opacity-90" style={{ animationDelay: '.8s' }}>🍕</div>
        <div className="absolute bottom-24 left-24 text-5xl floaty opacity-90" style={{ animationDelay: '1.4s' }}>🍤</div>
        <div className="absolute bottom-32 right-28 text-4xl floaty opacity-90" style={{ animationDelay: '.4s' }}>🥗</div>

        <div className="relative z-10 text-center anim-up">
          <div className="text-7xl mb-6 floaty">🧑‍🍳</div>
          <h1 className="font-display font-bold text-4xl mb-3 text-balance">Restaurant SaaS</h1>
          <p className="text-white/90 max-w-xs leading-relaxed">
            จัดการร้านอาหารง่ายๆ ตั้งแต่เมนู ออเดอร์ ครัว ไปจนถึงรายงานยอดขาย
          </p>
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm anim-up">
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="size-12 rounded-2xl bg-accent flex items-center justify-center text-2xl shadow-lg shadow-accent/30">🍜</div>
            <span className="font-display font-bold text-2xl">Restaurant SaaS</span>
          </div>

          <h2 className="font-display font-bold text-3xl text-text mb-2 text-balance">สวัสดีครับ 👋</h2>
          <p className="text-muted text-sm mb-8">เข้าสู่ระบบสำหรับผู้จัดการและพนักงาน</p>

          {error && (
            <div className="bg-rose/10 border border-rose/20 text-rose rounded-2xl px-4 py-3 text-sm mb-6 anim-pop">{error}</div>
          )}

          {unverified && (
            <div className="bg-yellow/10 border border-yellow/30 rounded-2xl px-4 py-3 text-sm mb-6 anim-pop space-y-2">
              <p className="font-semibold text-text">📬 กรุณายืนยัน Email ก่อนเข้าสู่ระบบ</p>
              <p className="text-muted text-xs">ตรวจสอบกล่องจดหมายที่ <span className="font-medium text-text">{form.email}</span></p>
              {resent ? (
                <p className="text-green text-xs font-medium">✓ ส่งลิงก์ยืนยันใหม่แล้ว</p>
              ) : (
                <button onClick={resendVerification} disabled={resending}
                  className="text-accent text-xs font-semibold hover:underline disabled:opacity-60">
                  {resending ? 'กำลังส่ง...' : 'ส่งลิงก์ยืนยันใหม่อีกครั้ง →'}
                </button>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5 ml-1">อีเมล <span className="text-rose">*</span></label>
              <div className="relative">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
                <input type="email" value={form.email} placeholder="you@example.com"
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className={cn('input pl-11', submitted && !form.email && 'input-error')} />
              </div>
              {submitted && !form.email && <p className="field-error">กรุณากรอกอีเมล</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5 ml-1">รหัสผ่าน <span className="text-rose">*</span></label>
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
                <input type={showPw ? 'text' : 'password'} value={form.password} placeholder="••••••••"
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className={cn('input pl-11 pr-11', submitted && !form.password && 'input-error')} />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  aria-label={showPw ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text transition-colors p-1">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {submitted && !form.password && <p className="field-error">กรุณากรอกรหัสผ่าน</p>}
              {submitted && form.password && form.password.length < 6 && <p className="field-error">รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร</p>}
            </div>
            <div className="flex justify-end">
              <a href="/forgot-password" className="text-xs text-muted hover:text-accent transition-colors">
                ลืมรหัสผ่าน?
              </a>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3.5 text-base gap-2 disabled:opacity-70">
              {loading ? <><Spinner size={18} /> กำลังเข้าสู่ระบบ...</> : <>เข้าสู่ระบบ <ArrowRight size={18} /></>}
            </button>
          </form>

          <p className="mt-7 text-center text-sm text-muted">
            ยังไม่มีร้าน?{' '}
            <a href="/register" className="text-accent hover:underline font-semibold">ลงทะเบียนฟรี</a>
          </p>
        </div>
      </div>
    </div>
  )
}
