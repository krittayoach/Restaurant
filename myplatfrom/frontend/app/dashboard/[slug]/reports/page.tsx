'use client'
import { useState, useEffect } from 'react'
import { TrendingUp, ShoppingBag, Star, Calendar, Receipt, Download, FileText } from 'lucide-react'
import { api, getToken } from '@/lib/api'
import { LoadingScreen } from '@/components/LoadingScreen'
import { Spinner } from '@/components/Spinner'

function toLocalDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

function exportCSV(daily: any[], bestseller: any[], from: string, to: string) {
  const rows: string[] = []

  rows.push(`ยอดขายรายวัน (${from} ถึง ${to})`)
  rows.push('วันที่,รายได้ (บาท),จำนวนออเดอร์')
  daily.forEach(d => rows.push(`${d.date},${parseFloat(d.total).toFixed(2)},${d.count}`))

  rows.push('')
  rows.push('เมนูขายดี Top 10')
  rows.push('อันดับ,เมนู,จำนวน (ชิ้น),รายได้ (บาท)')
  bestseller.forEach((item, i) =>
    rows.push(`${i + 1},"${item.menu_name}",${item.total_qty},${parseFloat(item.revenue).toFixed(2)}`)
  )

  const bom = '﻿'
  const blob = new Blob([bom + rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `report_${from}_${to}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function exportPDF(daily: any[], bestseller: any[], summary: any, from: string, to: string, restaurantName: string) {
  const html = `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<title>รายงาน ${from} – ${to}</title>
<style>
  body { font-family: sans-serif; color: #1a1a1a; padding: 32px; font-size: 13px; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  p.sub { color: #666; margin: 0 0 24px; font-size: 12px; }
  .cards { display: flex; gap: 16px; margin-bottom: 24px; }
  .card { flex: 1; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; }
  .card .label { color: #888; font-size: 11px; margin-top: 4px; }
  .card .value { font-size: 18px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  th { background: #f3f4f6; text-align: left; padding: 8px 10px; font-size: 12px; border-bottom: 1px solid #e5e7eb; }
  td { padding: 7px 10px; border-bottom: 1px solid #f3f4f6; font-size: 12px; }
  h2 { font-size: 14px; margin: 0 0 8px; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
<h1>รายงานยอดขาย — ${restaurantName}</h1>
<p class="sub">ช่วงเวลา: ${from} ถึง ${to}</p>
<div class="cards">
  <div class="card"><div class="value">฿${parseFloat(summary.total ?? 0).toLocaleString()}</div><div class="label">รายได้รวม</div></div>
  <div class="card"><div class="value">${summary.order_count ?? 0} รายการ</div><div class="label">จำนวนออเดอร์</div></div>
  <div class="card"><div class="value">${bestseller[0]?.menu_name ?? '-'}</div><div class="label">เมนูขายดีสุด</div></div>
</div>
<h2>ยอดขายรายวัน</h2>
<table>
  <thead><tr><th>วันที่</th><th>รายได้ (บาท)</th><th>จำนวนออเดอร์</th></tr></thead>
  <tbody>${daily.map(d => `<tr><td>${d.date}</td><td>฿${parseFloat(d.total).toLocaleString()}</td><td>${d.count}</td></tr>`).join('')}</tbody>
</table>
<h2>เมนูขายดี Top 10</h2>
<table>
  <thead><tr><th>#</th><th>เมนู</th><th>จำนวน (ชิ้น)</th><th>รายได้ (บาท)</th></tr></thead>
  <tbody>${bestseller.map((item, i) => `<tr><td>${i + 1}</td><td>${item.menu_name}</td><td>${item.total_qty}</td><td>฿${parseFloat(item.revenue).toLocaleString()}</td></tr>`).join('')}</tbody>
</table>
</body></html>`

  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.onload = () => { win.print() }
}

export default function ReportsPage() {
  const today = toLocalDate(new Date())
  const d7ago = toLocalDate(new Date(Date.now() - 6 * 86400_000))

  const [from, setFrom] = useState(d7ago)
  const [to, setTo]     = useState(today)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [restaurantName, setRestaurantName] = useState('ร้านอาหาร')

  async function load(f: string, t: string) {
    setLoading(true)
    const token = getToken()
    const res = await api.get(`/reports/sales/range?from=${f}&to=${t}`, token).catch(() => null)
    setData(res)
    setLoading(false)
  }

  useEffect(() => {
    load(from, to)
    const slug = window.location.pathname.split('/')[2]
    api.get(`/restaurants/${slug}`).then((r: any) => { if (r?.name) setRestaurantName(r.name) }).catch(() => null)
  }, [])

  const daily      = data?.daily ?? []
  const summary    = data?.summary ?? { total: 0, order_count: 0 }
  const bestseller = data?.bestseller ?? []
  const maxDaily   = Math.max(...daily.map((d: any) => d.total ?? 0), 1)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-text">รายงาน</h1>
          <p className="text-muted text-sm mt-0.5">ยอดขายและสถิติร้าน</p>
        </div>
        {!loading && data && (
          <div className="flex gap-2">
            <button
              onClick={() => exportCSV(daily, bestseller, from, to)}
              className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg bg-bg3 text-text hover:bg-border transition-colors font-medium"
            >
              <Download size={15} />
              CSV
            </button>
            <button
              onClick={() => exportPDF(daily, bestseller, summary, from, to, restaurantName)}
              className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors font-medium"
            >
              <FileText size={15} />
              PDF
            </button>
          </div>
        )}
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
          className="btn-primary py-2 px-5 text-sm gap-2 disabled:opacity-70">
          {loading ? <><Spinner size={14} />กำลังโหลด...</> : 'ดูรายงาน'}
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
