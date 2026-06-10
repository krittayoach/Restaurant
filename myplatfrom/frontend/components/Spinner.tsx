import { cn } from '@/lib/cn'

export function Spinner({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <span
      className={cn('inline-block rounded-full border-2 border-current border-t-transparent animate-spin shrink-0', className)}
      style={{ width: size, height: size }}
    />
  )
}
