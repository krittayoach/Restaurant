export function LoadingScreen() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="w-10 h-10 rounded-full border-3 border-accent border-t-transparent animate-spin mx-auto mb-3" style={{ borderWidth: 3 }} />
        <p className="text-muted text-sm">กำลังโหลด...</p>
      </div>
    </div>
  )
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="card p-4 animate-pulse">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className={`h-4 bg-border rounded-lg mb-2 ${i === 0 ? 'w-1/2' : i % 2 === 0 ? 'w-3/4' : 'w-full'}`} />
      ))}
    </div>
  )
}
