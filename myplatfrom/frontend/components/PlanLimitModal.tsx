'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import * as Dialog from '@radix-ui/react-dialog'
import { Zap, X, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/cn'

const PLAN_LABEL: Record<string, string> = { free: 'Free', basic: 'Basic', pro: 'Pro' }
const NEXT_PLAN: Record<string, string> = { free: 'Basic', basic: 'Pro', pro: 'Pro' }

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

  const plan = detail?.plan ?? 'free'
  const limit = detail?.limit
  const slug  = params?.slug as string

  function goUpgrade() {
    setDetail(null)
    if (slug) router.push(`/dashboard/${slug}/settings`)
  }

  return (
    <Dialog.Root open={!!detail} onOpenChange={open => { if (!open) setDetail(null) }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-modal anim-in" />
        <Dialog.Content className="fixed inset-0 z-modal flex items-end sm:items-center justify-center p-4">
          <div className="bg-bg2 rounded-3xl w-full max-w-sm p-6 shadow-2xl anim-up">
            <div className="flex items-start justify-between mb-4">
              <div className="size-12 rounded-2xl bg-yellow/10 flex items-center justify-center">
                <Zap size={22} className="text-yellow" />
              </div>
              <Dialog.Close asChild>
                <button
                  aria-label="ปิด"
                  className="size-8 rounded-xl bg-bg3 flex items-center justify-center text-muted hover:text-text transition-colors">
                  <X size={15} />
                </button>
              </Dialog.Close>
            </div>

            <Dialog.Title className="font-display font-bold text-lg mb-1 text-balance">
              ถึงขีดจำกัดของแพ็กเกจ
            </Dialog.Title>
            <Dialog.Description asChild>
              <div>
                <p className="text-muted text-sm mb-1">
                  แพ็กเกจปัจจุบัน{' '}
                  <span className="font-semibold text-text">{PLAN_LABEL[plan] ?? plan}</span>
                  {limit !== undefined && ` รองรับสูงสุด ${limit} รายการ`}
                </p>
                <p className="text-muted text-sm mb-5">
                  อัปเกรดเป็น <span className="font-semibold text-yellow">{NEXT_PLAN[plan] ?? 'Pro'}</span> เพื่อเพิ่มขีดจำกัด
                </p>
              </div>
            </Dialog.Description>

            <div className="flex gap-3">
              <Dialog.Close asChild>
                <button className="flex-1 py-2.5 rounded-2xl bg-bg3 text-sm font-semibold text-muted hover:text-text transition-colors">
                  ปิด
                </button>
              </Dialog.Close>
              <button
                onClick={goUpgrade}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-yellow text-bg text-sm font-bold hover:bg-yellow/90 transition-colors"
                style={{ boxShadow: '0 6px 16px -6px rgba(217,119,6,.5)' }}>
                อัปเกรดแพ็กเกจ <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
