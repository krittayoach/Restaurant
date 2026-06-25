import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { jwtVerify } from 'jose'
import PrintButton from './PrintButton'

const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3010'

type InvoiceData = {
  order: {
    id: string
    created_at: string
    total: number
    discount: number
    payment_method: string | null
    payment_status: string
    table_label: string
  }
  restaurant: { name: string; promptpay: string | null }
  items: { menu_name: string; quantity: number; unit_price: number; note: string | null }[]
  promotion: { name: string } | null
}

function paymentLabel(method: string | null) {
  if (method === 'cash') return 'เงินสด'
  if (method === 'promptpay') return 'PromptPay'
  if (method === 'transfer') return 'โอนเงิน'
  return '-'
}

export default async function InvoicePage({ params }: { params: { orderId: string } }) {
  const token = cookies().get('session')?.value
  if (!token) redirect('/login')
  try { await jwtVerify(token, secret) } catch { redirect('/login') }

  const res = await fetch(`${API}/payment/invoice/${params.orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg2 text-muted text-sm">
        ไม่พบออเดอร์นี้ หรือคุณไม่มีสิทธิ์เข้าถึง
      </div>
    )
  }

  const data: InvoiceData = await res.json()
  const { order, restaurant, items, promotion } = data
  const subtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0)
  const date = new Date(order.created_at)
  const dateStr = date.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
  const timeStr = date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .receipt { box-shadow: none !important; max-width: 100% !important; border-radius: 0 !important; }
        }
      `}</style>

      <div className="min-h-screen bg-bg2 flex flex-col items-center py-10 px-4">
        {/* Controls (hidden on print) */}
        <div className="no-print mb-5 flex items-center gap-3">
          <PrintButton />
          <button
            onClick={undefined}
            onClickCapture={() => history.back()}
            className="px-4 py-2 rounded-xl border border-border text-sm text-muted hover:bg-bg3 transition-colors"
          >
            ← กลับ
          </button>
        </div>

        {/* Receipt */}
        <div className="receipt bg-white rounded-2xl shadow-md w-full max-w-xs p-6 space-y-4">
          {/* Header */}
          <div className="text-center border-b border-border pb-4">
            <h1 className="font-bold text-lg text-text">{restaurant.name}</h1>
            <p className="text-xs text-muted mt-1">ใบเสร็จรับเงิน</p>
          </div>

          {/* Meta */}
          <div className="space-y-1.5 text-sm">
            {[
              ['เลขที่', order.id.slice(0, 8).toUpperCase()],
              ['วันที่', `${dateStr} ${timeStr}`],
              ['โต๊ะ', order.table_label],
              ['ชำระด้วย', paymentLabel(order.payment_method)],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4">
                <span className="text-muted">{label}</span>
                <span className="text-text font-medium text-right">{value}</span>
              </div>
            ))}
          </div>

          {/* Items */}
          <div className="border-t border-b border-border py-4 space-y-2">
            {items.map((item, i) => (
              <div key={i} className="flex justify-between items-start text-sm gap-2">
                <div className="flex-1">
                  <span className="text-text">{item.menu_name}</span>
                  <span className="text-muted ml-1">×{item.quantity}</span>
                  {item.note && <p className="text-xs text-muted mt-0.5">{item.note}</p>}
                </div>
                <span className="text-text shrink-0">฿{(item.unit_price * item.quantity).toFixed(0)}</span>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-muted">
              <span>ยอดรวม</span>
              <span>฿{subtotal.toFixed(0)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-green">
                <span>ส่วนลด{promotion ? ` (${promotion.name})` : ''}</span>
                <span>-฿{order.discount.toFixed(0)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base text-text border-t border-border pt-2">
              <span>ยอดสุทธิ</span>
              <span>฿{order.total.toFixed(0)}</span>
            </div>
          </div>

          {/* Status */}
          <div className="text-center">
            <span className={`text-xs px-3 py-1 rounded-full font-medium ${
              order.payment_status === 'paid'
                ? 'bg-green/10 text-green'
                : order.payment_status === 'refunded'
                  ? 'bg-rose/10 text-rose'
                  : 'bg-yellow/10 text-yellow'
            }`}>
              {order.payment_status === 'paid' ? '✓ ชำระเงินแล้ว'
                : order.payment_status === 'refunded' ? 'คืนเงินแล้ว'
                : order.payment_status}
            </span>
          </div>

          <p className="text-center text-xs text-muted pt-2 border-t border-border">
            ขอบคุณที่ใช้บริการ
          </p>
        </div>
      </div>
    </>
  )
}
