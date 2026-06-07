'use client'
import { useState, useEffect } from 'react'
import { TrendingUp, ShoppingBag, Star, Calendar, Receipt } from 'lucide-react'
import { api, getToken } from '@/lib/api'
import { LoadingScreen } from '@/components/LoadingScreen'

function toLocalDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

export default function ReportsPage() {
  const today = toLocalDate(new Date())
  const d7ago = toLocalDate(new Date(Date.now() - 6 * 86400_000))

  const [from, setFrom] = useState(d7ago)
  const [to, setTo]     = useState(today)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  async function load(f: string, t: string) {
    setLoading(true)
    const token = getToken()
    const res = await api.get(`/reports/sales/range?from=${f}&to=${t}`, token).catch(() => null)
    setData(res)
    setLoading(false)
  }

  useEffect(() => { load(from, to) }, [])

  const daily      = data?.daily ?? []
  const summary    = data?.summary ?? { total: 0, order_count: 0 }
  const bestseller = data?.bestseller ?? []
  const maxDaily   = Math.max(...daily.map((d: any) => d.total ?? 0), 1)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl text-text">รายงาน</h1>
        <p className="text-muted text-sm mt-0.5">ยอดขายและสถิติร้าน</p>
      </div>

      {/* Date range filter */}
      <div className="card p-4 mb-6 flex flex-wrap items-end gap-3">
        <Calendar size={16} className="text-muted mb-2 shrink-0" />
        <div>
          <label className="block text-xs text-muted mb-1.5">จากวันที่</label>
          <input type="date" value={from} max={to}
            onChange={e => setFrom(e.target.value)}
            className="input py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1.5">ถึงวันที่</label>
          <input type="date" value={to} min={from} max={today}
            onChange={e => setTo(e.target.value)}
            className="input py-2 text-sm" />
        </div>
        <button onClick={() => load(from, to)} disabled={loading}
          className="btn-primary py-2 px-5 text-sm">
          {loading ? 'กำลังโหลด...' : 'ดูรายงาน'}
        </button>
        <div className="flex gap-2 ml-auto flex-wrap">
          {[
            { label: '7 วัน',   f: toLocalDate(new Date(Date.now() - 6 * 86400_000)),  t: today },
            { label: '30 วัน',  f: toLocalDate(new Date(Date.now() - 29 * 86400_000)), t: today },
            { label: 'เดือนนี้', f: today.slice(0, 8) + '01', t: today },
          ].map(p => (
            <button key={p.label} onClick={() => { setFrom(p.f); setTo(p.t); load(p.f, p.t) }}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${from === p.f && to === p.t ? 'bg-accent text-white' : 'bg-bg3 text-muted hover:bg-border'}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? <LoadingScreen /> : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: 'รายได้รวม',   value: `฿${parseFloat(summary.total ?? 0).toLocaleString()}`, icon: TrendingUp, color: 'text-accent',  bg: 'bg-accent/10' },
              { label: 'จำนวนออเดอร์', value: `${summary.order_count ?? 0} รายการ`,                 icon: Receipt,    color: 'text-green',   bg: 'bg-green/10' },
              { label: 'เมนูขายดีสุด', value: bestseller[0]?.menu_name ?? '-',                       icon: Star,       color: 'text-violet',  bg: 'bg-violet/10' },
            ].map(s => {
              const Icon = s.icon
              return (
                <div key={s.label} className="card p-5">
                  <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center mb-3`}>
                    <Icon size={18} className={s.color} />
                  </div>
                  <p className={`font-display font-bold text-xl ${s.color} truncate`}>{s.value}</p>
                  <p className="text-muted text-xs mt-1">{s.label}</p>
                </div>
              )
            })}
          </div>

          <div className="grid grid-cols-2 gap-5">
            {/* Daily chart */}
            <div className="card p-5">
              <p className="text-sm font-semibold text-text mb-5">ยอดขายรายวัน</p>
              <div className="space-y-3">
                {daily.length === 0
                  ? <p className="text-muted text-sm">ยังไม่มีข้อมูล</p>
                  : daily.map((d: any) => {
                      const pct = (d.total / maxDaily) * 100
                      return (
                        <div key={d.date}>
                          <div className="flex justify-between text-xs mb-1.5">
                            <span className="text-muted font-mono">{d.date}</span>
                            <span className="font-semibold text-accent">฿{parseFloat(d.total).toLocaleString()}</span>
                          </div>
                          <div className="h-2 bg-bg3 rounded-full overflow-hidden">
                            <div className="h-full bg-accent/80 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )
                    })
                }
              </div>
            </div>

            {/* Bestseller */}
            <div className="card p-5">
              <p className="text-sm font-semibold text-text mb-5">เมนูขายดี Top 10</p>
              <div className="space-y-3">
                {bestseller.length === 0
                  ? <p className="text-muted text-sm">ยังไม่มีข้อมูล</p>
                  : bestseller.map((item: any, i: number) => (
                      <div key={item.menu_name} className="flex items-center gap-2.5">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${i < 3 ? 'bg-accent text-white' : 'bg-bg3 text-muted'}`}>{i + 1}</span>
                        <span className="flex-1 text-sm truncate">{item.menu_name}</span>
                        <span className="text-xs text-muted">×{item.total_qty}</span>
                        <span className="text-xs font-semibold text-green">฿{parseFloat(item.revenue).toLocaleString()}</span>
                      </div>
                    ))
                }
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
