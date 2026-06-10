'use client'
import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from 'lucide-react'
import { cn } from '@/lib/cn'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface ToastItem {
  id: string
  type: ToastType
  message: string
  exiting?: boolean
}

interface ToastCtx {
  success: (msg: string) => void
  error:   (msg: string) => void
  warning: (msg: string) => void
  info:    (msg: string) => void
}

const Ctx = createContext<ToastCtx>({ success: () => {}, error: () => {}, warning: () => {}, info: () => {} })

const CONFIG: Record<ToastType, { icon: React.ElementType; card: string; icon_cls: string; bar: string }> = {
  success: { icon: CheckCircle2,   card: 'border-green/30 bg-green/5',   icon_cls: 'text-green',  bar: 'bg-green' },
  error:   { icon: AlertCircle,    card: 'border-rose/30 bg-rose/5',     icon_cls: 'text-rose',   bar: 'bg-rose' },
  warning: { icon: AlertTriangle,  card: 'border-yellow/30 bg-yellow/5', icon_cls: 'text-yellow', bar: 'bg-yellow' },
  info:    { icon: Info,           card: 'border-accent/30 bg-accent/5', icon_cls: 'text-accent', bar: 'bg-accent' },
}

const DURATION = 4000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts(t => t.map(x => x.id === id ? { ...x, exiting: true } : x))
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 220)
  }, [])

  const add = useCallback((type: ToastType, message: string) => {
    const id = Math.random().toString(36).slice(2, 9)
    setToasts(t => [...t.slice(-3), { id, type, message }])
    setTimeout(() => dismiss(id), DURATION)
  }, [dismiss])

  const ctx: ToastCtx = {
    success: msg => add('success', msg),
    error:   msg => add('error', msg),
    warning: msg => add('warning', msg),
    info:    msg => add('info', msg),
  }

  return (
    <Ctx.Provider value={ctx}>
      {children}
      <div className="fixed top-4 right-4 z-toast flex flex-col gap-2.5 w-[calc(100vw-2rem)] max-w-[360px] pointer-events-none">
        {toasts.map(toast => {
          const { icon: Icon, card, icon_cls, bar } = CONFIG[toast.type]
          return (
            <div key={toast.id}
              className={cn(
                'relative overflow-hidden card border shadow-xl pointer-events-auto flex items-start gap-3 px-4 py-3.5',
                card,
                toast.exiting ? 'anim-toast-out' : 'anim-toast'
              )}>
              <Icon size={18} className={cn(icon_cls, 'shrink-0 mt-0.5')} />
              <p className="flex-1 text-sm text-text leading-snug">{toast.message}</p>
              <button
                onClick={() => dismiss(toast.id)}
                aria-label="ปิด"
                className="text-muted hover:text-text transition-colors shrink-0 -mr-1">
                <X size={15} />
              </button>
              <div
                className={cn('absolute bottom-0 left-0 h-[3px] opacity-60 origin-left', bar)}
                style={{ animation: `shrinkWidth ${DURATION}ms linear forwards` }}
              />
            </div>
          )
        })}
      </div>
      <style>{`@keyframes shrinkWidth { from { transform: scaleX(1) } to { transform: scaleX(0) } }`}</style>
    </Ctx.Provider>
  )
}

export const useToast = () => useContext(Ctx)
