export function Spinner({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <span
      className={`inline-block rounded-full border-2 border-current border-t-transparent animate-spin shrink-0 ${className}`}
      style={{ width: size, height: size }}
    />
  )
}
