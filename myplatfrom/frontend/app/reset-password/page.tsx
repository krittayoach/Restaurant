'use client'
import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { api } from '@/lib/api'
import { Lock, ArrowRight, CheckCircle2, XCircle, Eye, EyeOff } from 'lucide-react'
import { Spinner } from '@/components/Spinner'
import { cn } from '@/lib/cn'

function ResetPasswordForm() {
  const params = useSearchParams()
  const token = params.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const passwordMismatch = submitted && confirm && password !== confirm

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (!password || password.length < 6 || password !== confirm) return
    setError(''); setLoading(true)
    try {
      await api.post('/auth/confirm-reset', { token, password })
      setDone(true)
    } catch (err: any) {
      if (err.message === 'token_invalid') {
        setError('ลิงก์นี้หมดอายุหรือถูกใช้ไปแล้ว กรุณาขอลิงก์ใหม่')
      } else {
        setError(err.message ?? 'เกิดข้อผิดพลาด กรุณาลองใหม่')
      }
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="text-center space-y-5">
        <div className="size-20 rounded-3xl bg-rose/10 flex items-center justify-center mx-auto">
          <XCircle size={36} className="text-rose" />
        </div>
        <div>
          <h2 className="font-display font-bold text-2xl text-text mb-2">ลิงก์ไม่ถูกต้อง</h2>
          <p className="text-muted text-sm">กรุณาใช้ลิงก์จากอีเมลที่ได้รับ</p>
        </div>
        <a href="/forgot-password" className="block text-sm text-accent hover:underline font-semibold">
          ขอลิงก์ใหม่ →
        </a>
      </div>
    )
  }

  if (done) {
    return (
      <div className="text-center space-y-5">
        <div className="size-20 rounded-3xl bg-green/10 flex items-center justify-center mx-auto">
          <CheckCircle2 size={36} className="text-green" />
        </div>
        <div>
          <h2 className="font-display font-bold text-2xl text-text mb-2 text-balance">ตั้งรหัสผ่านใหม่สำเร็จ!</h2>
          <p className="text-muted text-sm">คุณสามารถเข้าสู่ระบบด้วยรหัสผ่านใหม่ได้ทันที</p>
        </div>
        <a href="/login" className="inline-flex items-center justify-center gap-2 w-full bg-accent text-white font-bold py-3.5 rounded-2xl shadow-md shadow-accent/20 hover:brightness-110 transition-all">
          เข้าสู่ระบบ →
        </a>
      </div>
    )
  }

  return (
    <>
      <div className="mb-8">
        <div className="size-14 rounded-2xl bg-accent/10 flex items-center justify-center mb-5">
          <Lock size={26} className="text-accent" />
        </div>
        <h2 className="font-display font-bold text-3xl text-text mb-2 text-balance">ตั้งรหัสผ่านใหม่</h2>
        <p className="text-muted text-sm">รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร</p>
      </div>

      {error && (
        <div className="bg-rose/10 border border-rose/20 text-rose rounded-2xl px-4 py-3 text-sm mb-6 anim-pop">
          {error}
          {error.includes('หมดอายุ') && (
            <a href="/forgot-password" className="block mt-1 font-semibold underline">ขอลิงก์ใหม่ →</a>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-muted mb-1.5 ml-1">
            รหัสผ่านใหม่ <span className="text-rose">*</span>
          </label>
          <div className="relative">
            <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type={showPw ? 'text' : 'password'}
              value={password}
              placeholder="••••••••"
              onChange={e => setPassword(e.target.value)}
              className={cn('input pl-11 pr-11', submitted && (!password || password.length < 6) && 'input-error')}
            />
            <button type="button" onClick={() => setShowPw(v => !v)}
              aria-label={showPw ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text transition-colors p-1">
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {submitted && !password && <p className="field-error">กรุณากรอกรหัสผ่าน</p>}
          {submitted && password && password.length < 6 && <p className="field-error">รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร</p>}
        </div>

        <div>
          <label className="block text-xs font-medium text-muted mb-1.5 ml-1">
            ยืนยันรหัสผ่าน <span className="text-rose">*</span>
          </label>
          <div className="relative">
            <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type={showPw ? 'text' : 'password'}
              value={confirm}
              placeholder="••••••••"
              onChange={e => setConfirm(e.target.value)}
              className={cn('input pl-11', passwordMismatch && 'input-error')}
            />
          </div>
          {passwordMismatch && <p className="field-error">รหัสผ่านไม่ตรงกัน</p>}
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full py-3.5 text-base mt-2 gap-2 disabled:opacity-70">
          {loading ? <><Spinner size={18} /> กำลังบันทึก...</> : <>บันทึกรหัสผ่านใหม่ <ArrowRight size={18} /></>}
        </button>
      </form>
    </>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-bg">
      <div className="w-full max-w-sm anim-up">
        <a href="/login" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text transition-colors mb-8">
          ← กลับหน้า Login
        </a>
        <Suspense fallback={<div className="text-muted text-sm">กำลังโหลด...</div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  )
}
