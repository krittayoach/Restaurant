import type { OrderItemStatus, OrderStatus, PaymentStatus, TableStatus } from '@/types'

// ─── Currency ─────────────────────────────────────────────────────────────────

/** Format number as Thai Baht, e.g. 1234.5 → "฿1,234.50" */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

// ─── Date / Time ──────────────────────────────────────────────────────────────

/** e.g. "30 พ.ค. 2568" */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** e.g. "14:35" */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** e.g. "30 พ.ค. 2568 14:35" */
export function formatDateTime(iso: string): string {
  return `${formatDate(iso)} ${formatTime(iso)}`
}

/** Duration in minutes between two ISO strings (or now if end is omitted) */
export function durationMinutes(start: string, end?: string): number {
  const diff = new Date(end ?? Date.now()).getTime() - new Date(start).getTime()
  return Math.floor(diff / 60_000)
}

// ─── Status Labels ────────────────────────────────────────────────────────────

const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending:   'รอรับออเดอร์',
  cooking:   'กำลังปรุง',
  ready:     'พร้อมเสิร์ฟ',
  served:    'เสิร์ฟแล้ว',
  cancelled: 'ยกเลิก',
}

const ITEM_STATUS_LABEL: Record<OrderItemStatus, string> = {
  pending:   'รอ',
  cooking:   'กำลังปรุง',
  ready:     'พร้อม',
  served:    'เสิร์ฟแล้ว',
  cancelled: 'ยกเลิก',
}

const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  unpaid:               'ยังไม่ชำระ',
  pending_verification: 'รอตรวจสอบ',
  paid:                 'ชำระแล้ว',
  refunded:             'คืนเงินแล้ว',
}

const TABLE_STATUS_LABEL: Record<TableStatus, string> = {
  available: 'ว่าง',
  occupied:  'มีลูกค้า',
  reserved:  'จอง',
  cleaning:  'กำลังทำความสะอาด',
}

export const statusLabel = {
  order:   (s: OrderStatus)     => ORDER_STATUS_LABEL[s]   ?? s,
  item:    (s: OrderItemStatus) => ITEM_STATUS_LABEL[s]    ?? s,
  payment: (s: PaymentStatus)   => PAYMENT_STATUS_LABEL[s] ?? s,
  table:   (s: TableStatus)     => TABLE_STATUS_LABEL[s]   ?? s,
}

// ─── Status Colors (Tailwind classes) ─────────────────────────────────────────

export function orderStatusColor(status: OrderStatus): string {
  const map: Record<OrderStatus, string> = {
    pending:   'bg-yellow-100 text-yellow-800',
    cooking:   'bg-orange-100 text-orange-800',
    ready:     'bg-green-100  text-green-800',
    served:    'bg-gray-100   text-gray-600',
    cancelled: 'bg-red-100    text-red-700',
  }
  return map[status] ?? 'bg-gray-100 text-gray-600'
}

export function paymentStatusColor(status: PaymentStatus): string {
  const map: Record<PaymentStatus, string> = {
    unpaid:               'bg-red-100    text-red-700',
    pending_verification: 'bg-yellow-100 text-yellow-800',
    paid:                 'bg-green-100  text-green-800',
    refunded:             'bg-purple-100 text-purple-800',
  }
  return map[status] ?? 'bg-gray-100 text-gray-600'
}
