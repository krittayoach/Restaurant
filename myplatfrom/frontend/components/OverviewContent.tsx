'use client'
import Link from 'next/link'
import { cn } from '@/lib/cn'
import { useDashboardLang } from '@/lib/i18n-dashboard'

export default function OverviewContent({
  slug, weekly, bestseller,
}: { slug: string; weekly: any[]; bestseller: any[] }) {
  const { t } = useDashboardLang()

  const totalRevenue = weekly.reduce((s: number, d: any) => s + (Number(d.total) || 0), 0)
  const totalOrders  = weekly.reduce((s: number, d: any) => s + (Number(d.count) || 0), 0)
  const avgOrder     = totalOrders > 0 ? totalRevenue / totalOrders : 0
  const maxDay       = Math.max(...weekly.map((d: any) => d.total ?? 0), 1)

  const stats = [
    { label: t.overview.revenue7d,   value: `฿${totalRevenue.toLocaleString()}`, emoji: '💰', bg: 'bg-accent/10', text: 'text-accent' },
    { label: t.overview.orders,      value: totalOrders.toLocaleString(),         emoji: '🧾', bg: 'bg-blue/10',   text: 'text-blue' },
    { label: t.overview.avgPerOrder, value: `฿${avgOrder.toFixed(0)}`,            emoji: '📈', bg: 'bg-green/10',  text: 'text-green' },
  ]
  const quick = [
    { href: 'menu',       label: t.nav.menu,       emoji: '🍽️' },
    { href: 'tables/qr',  label: t.nav.tableQr,    emoji: '📱' },
    { href: 'promotions', label: t.nav.promotions,  emoji: '🎁' },
    { href: 'employees',  label: t.nav.employees,   emoji: '👥' },
    { href: 'reports',    label: t.nav.reports,     emoji: '📊' },
  ]

  return (
    <div className="p-5 md:p-8 max-w-5xl mx-auto">
      <div className="mb-7 anim-up">
        <h1 className="font-display font-bold text-2xl md:text-3xl text-text text-balance">{t.overview.title}</h1>
        <p className="text-muted text-sm mt-1">{t.overview.subtitle}</p>
      </div>

      <div className="grid grid-cols-3 gap-3 md:gap-4 mb-7">
        {stats.map((s, i) => (
          <div key={s.label} className={cn('card card-hover rounded-3xl p-4 md:p-5 anim-up', s.bg)} style={{ animationDelay: `${i * 80}ms` }}>
            <div className="text-2xl md:text-3xl mb-2">{s.emoji}</div>
            <p className={cn('font-display font-bold text-lg md:text-3xl leading-tight truncate', s.text)}>{s.value}</p>
            <p className="text-muted text-xs mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4 md:gap-5 mb-7">
        <div className="card p-5 anim-up" style={{ animationDelay: '120ms' }}>
          <p className="font-display font-semibold text-base mb-4 flex items-center gap-2">{t.overview.dailySales}</p>
          <div className="space-y-3">
            {weekly.length === 0 ? <p className="text-muted text-sm">{t.overview.noData}</p>
              : weekly.map((d: any) => {
                  const pct = (d.total / maxDay) * 100
                  return (
                    <div key={d.date}>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-muted font-mono">{d.date}</span>
                        <span className="font-semibold text-accent">฿{parseFloat(d.total).toLocaleString()}</span>
                      </div>
                      <div className="h-2.5 bg-bg3 rounded-full overflow-hidden">
                        <div className="h-full bg-accent rounded-full transition-all origin-left" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
          </div>
        </div>

        <div className="card p-5 anim-up" style={{ animationDelay: '180ms' }}>
          <p className="font-display font-semibold text-base mb-4 flex items-center gap-2">{t.overview.bestseller}</p>
          <div className="space-y-2.5">
            {bestseller.length === 0 ? <p className="text-muted text-sm">{t.overview.noData}</p>
              : bestseller.map((item: any, i: number) => (
                  <div key={item.menu_name} className="flex items-center gap-3">
                    <span className={cn('size-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0', i === 0 ? 'bg-accent text-white' : i < 3 ? 'bg-accent/15 text-accent' : 'bg-bg3 text-muted')}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                    </span>
                    <span className="flex-1 text-sm truncate">{item.menu_name}</span>
                    <span className="w-10 text-right text-xs text-muted shrink-0 tabular-nums">×{item.total_qty}</span>
                    <span className="w-16 text-right text-xs font-semibold text-green shrink-0 tabular-nums">฿{parseFloat(item.revenue).toLocaleString()}</span>
                  </div>
                ))}
          </div>
        </div>
      </div>

      <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3 ml-1">{t.overview.quickLinks}</p>
      <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
        {quick.map((l, i) => (
          <Link key={l.href} href={`/dashboard/${slug}/${l.href}`}
            className="card card-hover p-4 flex flex-col items-center gap-2 text-center anim-up" style={{ animationDelay: `${200 + i * 60}ms` }}>
            <span className="text-2xl">{l.emoji}</span>
            <span className="text-xs font-semibold text-text">{l.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
