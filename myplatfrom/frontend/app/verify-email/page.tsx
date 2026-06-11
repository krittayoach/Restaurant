'use client'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { api } from '@/lib/api'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'

export default function VerifyEmailPage() {
  const params = useSearchParams()
  const token = params.get('token') ?? ''
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')

  useEffect(() => {
    if (!token) { setStatus('error'); return }
    api.post('/auth/verify-email', { token })
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'))
  }, [token])

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-bg">
      <div className="w-full max-w-sm text-center anim-up space-y-5">
        {status === 'loading' && (
          <>
            <div className="size-20 rounded-3xl bg-blue/10 flex items-center justify-center mx-auto">
              <Loader2 size={36} className="text-blue animate-spin" />
            </div>
            <div>
              <h2 className="font-display font-bold text-2xl text-text mb-2">กำลังยืนยัน...</h2>
              <p className="text-muted text-sm">โปรดรอสักครู่</p>
            </div>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="size-20 rounded-3xl bg-green/10 flex items-center justify-center mx-auto">
              <CheckCircle2 size={36} className="text-green" />
            </div>
            <div>
              <h2 className="font-display font-bold text-2xl text-text mb-2">ยืนยันสำเร็จ! 🎉</h2>
              <p className="text-muted text-sm leading-relaxed">
                Email ของคุณได้รับการยืนยันแล้ว<br />
                คุณสามารถเข้าสู่ระบบได้ทันที
              </p>
            </div>
            <a href="/login"
              className="inline-flex items-center justify-center gap-2 w-full bg-accent text-white font-bold py-3.5 rounded-2xl shadow-md shadow-accent/20 hover:brightness-110 transition-all">
              เข้าสู่ระบบ →
            </a>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="size-20 rounded-3xl bg-rose/10 flex items-center justify-center mx-auto">
              <XCircle size={36} className="text-rose" />
            </div>
            <div>
              <h2 className="font-display font-bold text-2xl text-text mb-2">ลิงก์ไม่ถูกต้อง</h2>
              <p className="text-muted text-sm leading-relaxed">
                ลิงก์ยืนยันนี้หมดอายุหรือถูกใช้ไปแล้ว<br />
                กรุณาขอลิงก์ใหม่จากหน้า Login
              </p>
            </div>
            <a href="/login"
              className="block text-sm text-accent hover:underline font-semibold">
              ← กลับไปหน้า Login
            </a>
          </>
        )}
      </div>
    </div>
  )
}
