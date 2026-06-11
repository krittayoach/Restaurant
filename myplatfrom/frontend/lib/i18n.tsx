'use client'
import { useState, useEffect } from 'react'

export type Lang = 'th' | 'en'

type T = {
  loading: string
  loadingMenu: string
  table: string
  total: string
  sending: string
  orderTitle: string
  addMoreTitle: string
  addMoreBanner: string
  selectedItems: string
  notePlaceholder: string
  yourInfo: string
  name: string
  phone: string
  namePlaceholder: string
  phonePlaceholder: string
  selectItems: string
  addItem: string
  noMenu: string
  errorSelectItems: string
  errorNamePhone: string
  orderBtn: (total: string) => string
  addOrderBtn: (total: string) => string
  orderStatus: string
  noOrders: string
  orderItems: string
  payment: string
  amountDue: string
  promptpayInstruction: (total: string) => string
  attachSlip: string
  tapToSelectSlip: string
  sendSlip: string
  slipSent: string
  notifyStaff: string
  toPayment: string
  waitingVerification: string
  pleaseWait: string
  orderMore: string
  paymentComplete: string
  thankYou: string
  cancelItem: string
  errorTryAgain: string
  statusPending: string
  statusCooking: string
  statusReady: string
  statusServed: string
  statusCancelled: string
  reserveTitle: string
  reserveSubtitle: string
  step1: string
  dateLabel: string
  timeLabel: string
  partySizeLabel: string
  persons: (n: number) => string
  searching: string
  searchTables: string
  step2: string
  seats: string
  step3: string
  fullName: string
  notes: string
  notesPlaceholder: string
  booking: string
  confirmBooking: string
  noTablesError: string
  connectionError: string
  selectTableError: string
  enterNameError: string
  enterPhoneError: string
  cannotBookError: string
  cancelWarning: string
  step4: string
  step4sub: string
  preOrderEmpty: string
  paymentStep: string
  paymentStepSub: (total: string) => string
  preOrderItems: string
  preOrderTotal: string
  preOrderPending: string
  preOrderPaid: string
  preOrderRejected: string
  preOrderNone: string
  bookingConfirmed: string
  showOnArrival: string
  bookingNumber: string
  labelDate: string
  labelTime: string
  labelTable: string
  labelGuests: string
  labelName: string
  labelPhone: string
  notesLabel: string
  cancelInstruction: string
  bookAnother: string
  bookingNotFound: string
  backToBook: string
  cannotLoad: string
  invalidQR: string
  qrNotFound: string
  scanAgain: string
  backHome: string
  dateLocale: string
}

const th: T = {
  loading: 'กำลังโหลด...',
  loadingMenu: 'กำลังโหลดเมนู...',
  table: 'โต๊ะ',
  total: 'รวม',
  sending: 'กำลังส่ง...',
  orderTitle: 'สั่งอาหาร',
  addMoreTitle: 'สั่งอาหารเพิ่ม',
  addMoreBanner: '✚ เพิ่มในออเดอร์เดิม — รายการใหม่จะส่งไปครัวทันที',
  selectedItems: 'รายการที่เลือก',
  notePlaceholder: 'หมายเหตุ เช่น ไม่เผ็ด, ไม่ใส่ผัก',
  yourInfo: 'ข้อมูลของคุณ',
  name: 'ชื่อ',
  phone: 'เบอร์โทร',
  namePlaceholder: 'สมชาย ใจดี',
  phonePlaceholder: '0XX-XXX-XXXX',
  addItem: 'เพิ่ม',
  selectItems: 'เลือกรายการอาหาร',
  noMenu: 'ยังไม่มีเมนู',
  errorSelectItems: 'กรุณาเลือกรายการอาหาร',
  errorNamePhone: 'กรุณากรอกชื่อและเบอร์โทร',
  orderBtn: (total) => `สั่งอาหาร · ฿${total}`,
  addOrderBtn: (total) => `เพิ่มในออเดอร์เดิม · ฿${total}`,
  orderStatus: 'สถานะออเดอร์',
  noOrders: 'ยังไม่มีออเดอร์',
  orderItems: 'รายการอาหาร',
  payment: 'ชำระเงิน',
  amountDue: 'ยอดชำระ',
  promptpayInstruction: (total) => `กรุณาโอน ฿${total} แล้วแนบสลิปด้านล่าง`,
  attachSlip: 'แนบสลิปการโอนเงิน',
  tapToSelectSlip: 'แตะเพื่อเลือกรูปสลิป',
  sendSlip: 'ส่งสลิปให้พนักงาน',
  slipSent: '✓ ส่งสลิปแล้ว รอพนักงานยืนยัน',
  notifyStaff: 'กรุณาแจ้งพนักงาน',
  toPayment: 'เพื่อชำระเงิน',
  waitingVerification: 'รอพนักงานยืนยันการชำระเงิน',
  pleaseWait: 'โปรดรอสักครู่...',
  orderMore: 'สั่งอาหารเพิ่ม',
  paymentComplete: 'ชำระเงินเรียบร้อย',
  thankYou: 'ขอบคุณที่ใช้บริการ 🙏',
  cancelItem: 'ยกเลิกรายการนี้',
  errorTryAgain: 'เกิดข้อผิดพลาด กรุณาลองใหม่',
  statusPending: 'รอรับออเดอร์',
  statusCooking: 'กำลังทำ',
  statusReady: 'พร้อมเสิร์ฟ',
  statusServed: 'เสิร์ฟแล้ว',
  statusCancelled: 'ยกเลิก',
  reserveTitle: 'จองโต๊ะ',
  reserveSubtitle: 'เลือกวันเวลาและโต๊ะที่ต้องการ',
  step1: '1. เลือกวันและเวลา',
  dateLabel: 'วันที่',
  timeLabel: 'เวลา',
  partySizeLabel: 'จำนวนคน',
  persons: (n) => `${n} คน`,
  searching: 'กำลังค้นหา...',
  searchTables: 'ค้นหาโต๊ะว่าง',
  step2: '2. เลือกโต๊ะ',
  seats: 'ที่นั่ง',
  step3: '3. ข้อมูลผู้จอง',
  fullName: 'ชื่อ-นามสกุล',
  notes: 'หมายเหตุ (ถ้ามี)',
  notesPlaceholder: 'เช่น แพ้อาหาร, ต้องการเก้าอี้เด็ก...',
  booking: 'กำลังจอง...',
  confirmBooking: 'ยืนยันการจอง',
  noTablesError: 'ไม่มีโต๊ะว่างในช่วงเวลานี้ กรุณาเลือกเวลาอื่น',
  connectionError: 'ไม่สามารถเชื่อมต่อได้',
  selectTableError: 'กรุณาเลือกโต๊ะ',
  enterNameError: 'กรุณากรอกชื่อ',
  enterPhoneError: 'กรุณากรอกเบอร์โทรให้ครบ',
  cannotBookError: 'ไม่สามารถจองได้ กรุณาลองใหม่',
  cancelWarning: '⚠️ ไม่สามารถยกเลิกการจองได้ภายใน 1 ชั่วโมงก่อนเวลาที่จอง',
  step4: '4. สั่งอาหารล่วงหน้า (ไม่บังคับ)',
  step4sub: 'เลือกเมนูที่ต้องการ ครัวจะเตรียมไว้ก่อนคุณมาถึง',
  preOrderEmpty: 'ยังไม่ได้เลือกเมนู',
  paymentStep: '5. ชำระเงินล่วงหน้า',
  paymentStepSub: (total) => `กรุณาโอน ฿${total} แล้วแนบสลิปด้านล่าง`,
  preOrderItems: 'รายการอาหารที่จองล่วงหน้า',
  preOrderTotal: 'ยอดรวมล่วงหน้า',
  preOrderPending: 'รอพนักงานยืนยันชำระเงิน',
  preOrderPaid: 'ชำระเงินแล้ว ✓',
  preOrderRejected: 'การชำระเงินไม่ผ่าน — กรุณาติดต่อร้าน',
  preOrderNone: '',
  bookingConfirmed: 'จองสำเร็จแล้ว!',
  showOnArrival: 'กรุณาแสดงหน้านี้เมื่อมาถึงร้าน',
  bookingNumber: 'หมายเลขการจอง',
  labelDate: 'วันที่',
  labelTime: 'เวลา',
  labelTable: 'โต๊ะ',
  labelGuests: 'จำนวนคน',
  labelName: 'ชื่อ',
  labelPhone: 'เบอร์',
  notesLabel: 'หมายเหตุ',
  cancelInstruction: 'หากต้องการยกเลิก กรุณาติดต่อร้านโดยตรง',
  bookAnother: 'จองเพิ่มเติม',
  bookingNotFound: 'ไม่พบการจอง',
  backToBook: '← กลับไปจองใหม่',
  cannotLoad: 'ไม่สามารถโหลดข้อมูลได้',
  invalidQR: 'QR Code ไม่ถูกต้อง',
  qrNotFound: 'ไม่พบโต๊ะที่ตรงกับ QR Code นี้',
  scanAgain: 'กรุณาสแกน QR Code ใหม่จากโต๊ะของคุณ',
  backHome: 'กลับหน้าแรก',
  dateLocale: 'th-TH',
}

const en: T = {
  loading: 'Loading...',
  loadingMenu: 'Loading menu...',
  table: 'Table',
  total: 'Total',
  sending: 'Sending...',
  orderTitle: 'Order',
  addMoreTitle: 'Add More',
  addMoreBanner: '✚ Adding to existing order — new items sent to kitchen immediately',
  selectedItems: 'Selected Items',
  notePlaceholder: 'Notes e.g. not spicy, no vegetables',
  yourInfo: 'Your Info',
  name: 'Name',
  phone: 'Phone',
  namePlaceholder: 'John Doe',
  phonePlaceholder: '0XX-XXX-XXXX',
  addItem: 'Add',
  selectItems: 'Select items',
  noMenu: 'No menu items yet',
  errorSelectItems: 'Please select items',
  errorNamePhone: 'Please enter name and phone',
  orderBtn: (total) => `Order · ฿${total}`,
  addOrderBtn: (total) => `Add to Order · ฿${total}`,
  orderStatus: 'Order Status',
  noOrders: 'No orders yet',
  orderItems: 'Order Items',
  payment: 'Payment',
  amountDue: 'Amount due',
  promptpayInstruction: (total) => `Please transfer ฿${total} and attach slip below`,
  attachSlip: 'Attach Transfer Slip',
  tapToSelectSlip: 'Tap to select slip image',
  sendSlip: 'Send Slip to Staff',
  slipSent: '✓ Slip sent, waiting for staff confirmation',
  notifyStaff: 'Please notify staff',
  toPayment: 'to make payment',
  waitingVerification: 'Waiting for staff to confirm payment',
  pleaseWait: 'Please wait...',
  orderMore: 'Order More',
  paymentComplete: 'Payment Complete',
  thankYou: 'Thank you for your visit 🙏',
  cancelItem: 'Cancel this item',
  errorTryAgain: 'Error, please try again',
  statusPending: 'Waiting',
  statusCooking: 'Cooking',
  statusReady: 'Ready',
  statusServed: 'Served',
  statusCancelled: 'Cancelled',
  reserveTitle: 'Table Reservation',
  reserveSubtitle: 'Select date, time, and table',
  step1: '1. Select Date & Time',
  dateLabel: 'Date',
  timeLabel: 'Time',
  partySizeLabel: 'Party Size',
  persons: (n) => `${n} ${n === 1 ? 'person' : 'persons'}`,
  searching: 'Searching...',
  searchTables: 'Find Available Tables',
  step2: '2. Select Table',
  seats: 'seats',
  step3: '3. Booker Info',
  fullName: 'Full Name',
  notes: 'Notes (optional)',
  notesPlaceholder: 'e.g. allergies, need a high chair...',
  booking: 'Booking...',
  confirmBooking: 'Confirm Booking',
  noTablesError: 'No available tables for this time. Please choose another.',
  connectionError: 'Cannot connect to server',
  selectTableError: 'Please select a table',
  enterNameError: 'Please enter your name',
  enterPhoneError: 'Please enter a valid phone number',
  cannotBookError: 'Cannot book, please try again',
  cancelWarning: '⚠️ Reservations cannot be cancelled within 1 hour of the reserved time',
  step4: '4. Pre-order Food (Optional)',
  step4sub: 'Select items and the kitchen will prepare them before you arrive',
  preOrderEmpty: 'No items selected',
  paymentStep: '5. Pre-payment',
  paymentStepSub: (total) => `Please transfer ฿${total} and attach slip below`,
  preOrderItems: 'Pre-ordered Items',
  preOrderTotal: 'Pre-order Total',
  preOrderPending: 'Awaiting staff payment confirmation',
  preOrderPaid: 'Payment confirmed ✓',
  preOrderRejected: 'Payment not accepted — please contact the restaurant',
  preOrderNone: '',
  bookingConfirmed: 'Booking Confirmed!',
  showOnArrival: 'Please show this page when you arrive',
  bookingNumber: 'Booking Number',
  labelDate: 'Date',
  labelTime: 'Time',
  labelTable: 'Table',
  labelGuests: 'Guests',
  labelName: 'Name',
  labelPhone: 'Phone',
  notesLabel: 'Notes',
  cancelInstruction: 'To cancel, please contact the restaurant directly',
  bookAnother: 'Book Another Table',
  bookingNotFound: 'Booking not found',
  backToBook: '← Back to Book Again',
  cannotLoad: 'Cannot load booking data',
  invalidQR: 'Invalid QR Code',
  qrNotFound: 'No table found for this QR Code',
  scanAgain: 'Please scan a new QR Code from your table',
  backHome: 'Back to Home',
  dateLocale: 'en-GB',
}

const translations: Record<Lang, T> = { th, en }

export function useI18n() {
  const [lang, setLangState] = useState<Lang>('th')

  useEffect(() => {
    const stored = localStorage.getItem('lang') as Lang | null
    if (stored === 'th' || stored === 'en') setLangState(stored)
  }, [])

  const setLang = (l: Lang) => {
    setLangState(l)
    localStorage.setItem('lang', l)
  }

  return { t: translations[lang], lang, setLang }
}

export function LangToggle({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  return (
    <div className="flex items-center gap-0.5 text-xs font-bold select-none">
      <button
        onClick={() => setLang('th')}
        className={`px-1.5 py-0.5 rounded transition-colors ${lang === 'th' ? 'text-orange-400' : 'text-gray-300 hover:text-gray-400'}`}
      >TH</button>
      <span className="text-gray-200">|</span>
      <button
        onClick={() => setLang('en')}
        className={`px-1.5 py-0.5 rounded transition-colors ${lang === 'en' ? 'text-orange-400' : 'text-gray-300 hover:text-gray-400'}`}
      >EN</button>
    </div>
  )
}
