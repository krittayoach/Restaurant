'use client'
import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { Trash2, AlertTriangle } from 'lucide-react'

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
      {opts && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm anim-in"
          onClick={() => respond(false)}>
          <div className="bg-bg2 border border-border rounded-3xl p-6 w-full max-w-sm shadow-2xl anim-pop"
            onClick={e => e.stopPropagation()}>
            <div className={`w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center ${opts.danger ? 'bg-rose/10' : 'bg-yellow/10'}`}>
              {opts.danger
                ? <Trash2 size={24} className="text-rose" />
                : <AlertTriangle size={24} className="text-yellow" />}
            </div>
            <h3 className="font-display font-bold text-lg text-center text-text mb-1">{opts.title}</h3>
            {opts.message && <p className="text-sm text-muted text-center mb-5">{opts.message}</p>}
            {!opts.message && <div className="mb-5" />}
            <div className="flex gap-3">
              <button onClick={() => respond(false)} className="flex-1 btn-secondary">ยกเลิก</button>
              <button onClick={() => respond(true)}
                className={`flex-1 py-2.5 rounded-2xl text-sm font-semibold transition-colors ${
                  opts.danger ? 'bg-rose text-white hover:bg-rose/90' : 'bg-yellow text-white hover:bg-yellow/90'
                }`}>
                {opts.confirmLabel ?? 'ยืนยัน'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  )
}

export const useConfirm = () => useContext(Ctx)
