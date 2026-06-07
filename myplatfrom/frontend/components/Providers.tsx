'use client'
import { ToastProvider } from './Toast'
import { ConfirmProvider } from './ConfirmModal'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ConfirmProvider>{children}</ConfirmProvider>
    </ToastProvider>
  )
}
