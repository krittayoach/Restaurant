'use client'
import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { CheckCircle, Calendar, Clock, Users, MapPin, Phone, User, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

function formatDateTime(iso: string) {
  const d = new Date(iso)
  return {
    date: d.toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    time: d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
  }
}

export default function ConfirmPage() {
  const { slug }       = useParams() as { slug: string }
  const searchParams   = useSearchParams()
  const id             = searchParams.get('id')
  const [res, setRes]  = useState<any>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) { setError('ไม่พบการจอง'); return }
    fetch(`${API}/reservations/public/booking/${id}`)
      .then(r => r.json())
      .then(data => { if (data.error) setError(data.error); else setRes(data) })
      .catch(() => setError('ไม่สามารถโหลดข้อมูลได้'))
  }, [id])

  if (error) return (
    <div className="min-h-screen bg-bg2 flex items-center justify-center px-4">
      <div className="text-center">
        <p className="text-red-500 mb-4">{error}</p>
        <Link href={`/r/${slug}/reserve`} className="text-accent text-sm">← กลับไปจองใหม่</Link>
      </div>
    </div>
  )

  if (!res) return (
    <div className="min-h-screen bg-bg2 flex items-center justify-center">
      <div className="text-muted text-sm">กำลังโหลด...</div>
    </div>
  )

  const { date, time } = formatDateTime(res.reserved_at)

  return (
    <div className="min-h-screen bg-bg2 flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-green/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-green" />
          </div>
          <h1 className="font-display font-bold text-2xl text-text">จองสำเร็จแล้ว!</h1>
          <p className="text-muted text-sm mt-1">กรุณาแสดงหน้านี้เมื่อมาถึงร้าน</p>
        </div>

        <div className="card p-6 space-y-4">
          <div className="pb-4 border-b border-border">
            <p className="text-xs text-muted mb-1">หมายเลขการจอง</p>
            <p className="font-mono text-sm font-bold text-accent">{res.id.slice(0, 8).toUpperCase()}</p>
          </div>

          {[
            { icon: Calendar, label: 'วันที่', value: date },
            { icon: Clock,    label: 'เวลา',   value: time },
            { icon: MapPin,   label: 'โต๊ะ',   value: `${res.table_label} (${res.table_seats} ที่นั่ง)` },
            { icon: Users,    label: 'จำนวนคน', value: `${res.party_size} คน` },
            { icon: User,     label: 'ชื่อ',   value: res.customer_name },
            { icon: Phone,    label: 'เบอร์',   value: res.customer_phone },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-bg3 flex items-center justify-center shrink-0">
                <Icon size={15} className="text-muted" />
              </div>
              <div>
                <p className="text-xs text-muted">{label}</p>
                <p className="text-sm font-medium text-text">{value}</p>
              </div>
            </div>
          ))}

          {res.notes && (
            <div className="pt-3 border-t border-border">
              <p className="text-xs text-muted mb-1">หมายเหตุ</p>
              <p className="text-sm text-text">{res.notes}</p>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-muted mt-6">
          หากต้องการยกเลิก กรุณาติดต่อร้านโดยตรง
        </p>
        <div className="text-center mt-3">
          <Link href={`/r/${slug}/reserve`} className="text-accent text-sm flex items-center justify-center gap-1">
            <ArrowLeft size={14} />จองเพิ่มเติม
          </Link>
        </div>
      </div>
    </div>
  )
}
