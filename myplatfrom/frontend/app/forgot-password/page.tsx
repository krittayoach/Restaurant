'use client'
import { useState } from 'react'
import { api } from '@/lib/api'
import { Mail, ArrowRight, CheckCircle2 } from 'lucide-react'
import { Spinner } from '@/components/Spinner'
import { cn } from '@/lib/cn'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (!email) return
    setError(''); setLoading(true)
    try {
      await api.post('/auth/forgot-password', { email })
      setDone(true)
    } catch (err: any) {
      setError(err.message ?? 'เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-bg">
      <div className="w-full max-w-sm anim-up">
        <a href="/login" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text transition-colors mb-8">
          ← กลับหน้า Login
        </a>

        {done ? (
          <div className="text-center space-y-5">
            <div className="size-20 rounded-3xl bg-green/10 flex items-center justify-center mx-auto">
              <CheckCircle2 size={36} className="text-green" />
            </div>
            <div>
              <h2 className="font-display font-bold text-2xl text-text mb-2 text-balance">ตรวจสอบ Email ของคุณ</h2>
              <p className="text-muted text-sm leading-relaxed">
                หากมีบัญชีที่ผูกกับ <span className="font-medium text-text">{email}</span> ระบบจะส่งลิงก์รีเซ็ตรหัสผ่านให้ภายในไม่กี่นาที
              </p>
            </div>
            <p className="text-xs text-muted">ลิงก์จะหมดอายุใน 1 ชั่วโมง</p>
            <a href="/login" className="block text-sm text-accent hover:underline font-semibold">
              กลับไปหน้า Login →
            </a>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <div className="size-14 rounded-2xl bg-accent/10 flex items-center justify-center mb-5">
                <Mail size={26} className="text-accent" />
              </div>
              <h2 className="font-display font-bold text-3xl text-text mb-2 text-balance">ลืมรหัสผ่าน?</h2>
              <p className="text-muted text-sm">กรอก Email ที่ลงทะเบียนไว้ ระบบจะส่งลิงก์รีเซ็ตให้</p>
            </div>

            {error && (
              <div className="bg-rose/10 border border-rose/20 text-rose rounded-2xl px-4 py-3 text-sm mb-6 anim-pop">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5 ml-1">
                  อีเมล <span className="text-rose">*</span>
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    type="email"
                    value={email}
                    placeholder="you@example.com"
                    onChange={e => setEmail(e.target.value)}
                    className={cn('input pl-11', submitted && !email && 'input-error')}
                  />
                </div>
                {submitted && !email && <p className="field-error">กรุณากรอกอีเมล</p>}
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full py-3.5 text-base mt-2 gap-2 disabled:opacity-70">
                {loading ? <><Spinner size={18} /> กำลังส่ง...</> : <>ส่งลิงก์รีเซ็ต <ArrowRight size={18} /></>}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
