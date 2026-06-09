'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Zap, X, ArrowRight } from 'lucide-react'

const PLAN_LABEL: Record<string, string> = { free: 'Free', basic: 'Basic', pro: 'Pro' }
const NEXT_PLAN: Record<string, string> = { free: 'Basic', basic: 'Pro', pro: 'Pro' }
const LIMIT_LABEL: Record<string, Record<string, string>> = {
  tables:     { free: '5 โต๊ะ',      basic: '20 โต๊ะ' },
  menus:      { free: '20 เมนู',     basic: '100 เมนู' },
  employees:  { free: '3 พนักงาน',  basic: '15 พนักงาน' },
  promotions: { free: '2 โปรโมชั่น', basic: '10 โปรโมชั่น' },
}

export default function PlanLimitModal() {
  const [detail, setDetail] = useState<any>(null)
  const router = useRouter()
  const params = useParams()

  useEffect(() => {
    function handler(e: Event) {
      setDetail((e as CustomEvent).detail)
    }
    window.addEventListener('plan-limit-reached', handler)
    return () => window.removeEventListener('plan-limit-reached', handler)
  }, [])

  if (!detail) return null

  const plan  = detail.plan ?? 'free'
  const limit = detail.limit
  const slug  = params?.slug as string

  function goUpgrade() {
    setDetail(null)
    if (slug) router.push(`/dashboard/${slug}/settings`)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-end sm:items-center justify-center p-4">
      <div className="bg-bg2 rounded-3xl w-full max-w-sm p-6 shadow-2xl anim-up">
        <div className="flex items-start justify-between mb-4">
          <div className="w-12 h-12 rounded-2xl bg-yellow/10 flex items-center justify-center">
            <Zap size={22} className="text-yellow" />
          </div>
          <button onClick={() => setDetail(null)}
            className="w-8 h-8 rounded-xl bg-bg3 flex items-center justify-center text-muted hover:text-text transition-colors">
            <X size={15} />
          </button>
        </div>

        <h3 className="font-display font-bold text-lg mb-1">ถึงขีดจำกัดของแพ็กเกจ</h3>
        <p className="text-muted text-sm mb-1">
          แพ็กเกจปัจจุบัน{' '}
          <span className="font-semibold text-text">{PLAN_LABEL[plan] ?? plan}</span>
          {limit !== undefined && ` รองรับสูงสุด ${limit} รายการ`}
        </p>
        <p className="text-muted text-sm mb-5">
          อัปเกรดเป็น <span className="font-semibold text-yellow">{NEXT_PLAN[plan] ?? 'Pro'}</span> เพื่อเพิ่มขีดจำกัด
        </p>

        <div className="flex gap-3">
          <button onClick={() => setDetail(null)}
            className="flex-1 py-2.5 rounded-2xl bg-bg3 text-sm font-semibold text-muted hover:text-text transition-colors">
            ปิด
          </button>
          <button onClick={goUpgrade}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-yellow text-bg text-sm font-bold hover:bg-yellow/90 transition-colors"
            style={{ boxShadow: '0 6px 16px -6px rgba(217,119,6,.5)' }}>
            อัปเกรดแพ็กเกจ <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
