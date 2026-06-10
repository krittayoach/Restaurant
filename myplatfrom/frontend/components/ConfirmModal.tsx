'use client'
import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import * as AlertDialog from '@radix-ui/react-alert-dialog'
import { Trash2, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/cn'

interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  danger?: boolean
}

type Resolver = (v: boolean) => void

interface ConfirmCtx {
  confirm: (opts: ConfirmOptions) => Promise<boolean>
}

const Ctx = createContext<ConfirmCtx>({ confirm: async () => false })

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null)
  const [resolver, setResolver] = useState<Resolver | null>(null)

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise(resolve => {
      setOpts(options)
      setResolver(() => resolve)
    })
  }, [])

  function respond(value: boolean) {
    resolver?.(value)
    setOpts(null)
    setResolver(null)
  }

  return (
    <Ctx.Provider value={{ confirm }}>
      {children}
      <AlertDialog.Root open={!!opts} onOpenChange={open => { if (!open) respond(false) }}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-modal bg-black/50 backdrop-blur-sm anim-in" />
          <AlertDialog.Content className="fixed inset-0 z-modal flex items-center justify-center p-4">
            <div className="bg-bg2 border border-border rounded-3xl p-6 w-full max-w-sm shadow-2xl anim-pop"
              onClick={e => e.stopPropagation()}>
              <div className={cn(
                'size-14 rounded-2xl mx-auto mb-4 flex items-center justify-center',
                opts?.danger ? 'bg-rose/10' : 'bg-yellow/10'
              )}>
                {opts?.danger
                  ? <Trash2 size={24} className="text-rose" />
                  : <AlertTriangle size={24} className="text-yellow" />}
              </div>
              <AlertDialog.Title className="font-display font-bold text-lg text-center text-text mb-1">
                {opts?.title}
              </AlertDialog.Title>
              {opts?.message && (
                <AlertDialog.Description className="text-sm text-muted text-center mb-5">
                  {opts.message}
                </AlertDialog.Description>
              )}
              {!opts?.message && <div className="mb-5" />}
              <div className="flex gap-3">
                <AlertDialog.Cancel asChild>
                  <button onClick={() => respond(false)} className="flex-1 btn-secondary">ยกเลิก</button>
                </AlertDialog.Cancel>
                <AlertDialog.Action asChild>
                  <button
                    onClick={() => respond(true)}
                    className={cn(
                      'flex-1 py-2.5 rounded-2xl text-sm font-semibold transition-colors',
                      opts?.danger ? 'bg-rose text-white hover:bg-rose/90' : 'bg-yellow text-white hover:bg-yellow/90'
                    )}>
                    {opts?.confirmLabel ?? 'ยืนยัน'}
                  </button>
                </AlertDialog.Action>
              </div>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </Ctx.Provider>
  )
}

export const useConfirm = () => useContext(Ctx)
