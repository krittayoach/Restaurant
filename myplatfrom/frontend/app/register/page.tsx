'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { ArrowRight, Eye, EyeOff } from 'lucide-react'

const FIELDS = [
  { key: 'name',        label: 'ชื่อร้านอาหาร',          placeholder: 'ร้านอร่อยริมทาง',  type: 'text', span: true },
  { key: 'slug',        label: 'URL ร้าน (อังกฤษ)',      placeholder: 'my-restaurant',   type: 'text' },
  { key: 'promptpay',   label: 'PromptPay',              placeholder: '0XX-XXX-XXXX',    type: 'text', optional: true },
  { key: 'managerName', label: 'ชื่อผู้จัดการ',           placeholder: 'สมชาย ใจดี',      type: 'text' },
  { key: 'phone',       label: 'เบอร์โทร (ใช้ login)',    placeholder: '0XX-XXX-XXXX',    type: 'tel' },
  { key: 'password',    label: 'รหัสผ่าน (≥6 ตัว)',       placeholder: '••••••••',         type: 'password', span: true },
]

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({ slug: '', name: '', managerName: '', phone: '', password: '', promptpay: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [showPw, setShowPw] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    const required = FIELDS.filter(f => !f.optional).map(f => f.key)
    if (required.some(k => !(form as any)[k])) return
    if (form.password.length < 6) return
    setError(''); setLoading(true)
    try {
      await api.post('/restaurants/register', form)
      router.push('/login')
    } catch (err: any) { setError(err.message) } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md anim-up">
        <div className="flex items-center gap-3 mb-7 justify-center">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent to-rose flex items-center justify-center text-2xl shadow-lg shadow-accent/30 floaty">🍜</div>
          <span className="font-display font-bold text-2xl">Restaurant SaaS</span>
        </div>

        <div className="card p-8">
          <h2 className="font-display font-bold text-2xl text-text mb-1">เปิดร้านใหม่ 🎉</h2>
          <p className="text-muted text-sm mb-7">สร้างบัญชีและร้านของคุณในไม่กี่วินาที</p>

          {error && <div className="bg-rose/10 border border-rose/20 text-rose rounded-2xl px-4 py-3 text-sm mb-5 anim-pop">{error}</div>}

          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            {FIELDS.map(f => (
              <div key={f.key} className={f.span ? 'col-span-2' : ''}>
                <label className="block text-xs font-medium text-muted mb-1.5 ml-1">
                  {f.label}{f.optional ? <span className="text-muted/60"> · ไม่บังคับ</span> : <span className="text-rose"> *</span>}
                </label>
                <div className="relative">
                  <input
                    type={f.type === 'password' ? (showPw ? 'text' : 'password') : f.type}
                    placeholder={f.placeholder} value={(form as any)[f.key]}
                    onChange={e => setForm(v => ({ ...v, [f.key]: e.target.value }))}
                    className={`input ${f.type === 'password' ? 'pr-11' : ''} ${submitted && !f.optional && !(form as any)[f.key] ? 'input-error' : ''}`} />
                  {f.type === 'password' && (
                    <button type="button" onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text transition-colors p-1">
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  )}
                </div>
                {submitted && !f.optional && !(form as any)[f.key] && <p className="field-error">กรุณากรอก{f.label.replace(/ *\(.*\)/, '')}</p>}
                {submitted && f.key === 'password' && form.password.length > 0 && form.password.length < 6 && <p className="field-error">รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร</p>}
              </div>
            ))}
            <button type="submit" disabled={loading} className="btn-primary w-full py-3.5 text-base col-span-2 mt-1">
              {loading ? 'กำลังสร้างร้าน...' : <>สร้างร้านอาหาร <ArrowRight size={18} /></>}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-sm text-muted">
          มีบัญชีแล้ว? <a href="/login" className="text-accent hover:underline font-semibold">เข้าสู่ระบบ</a>
        </p>
      </div>
    </div>
  )
}
