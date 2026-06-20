'use client'
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

export type DashboardLang = 'th' | 'en'

// ─── Translation type ──────────────────────────────────────────────────────────
export type DashboardT = {
  common: {
    loading: string; save: string; saving: string; saved: string
    edit: string; delete: string; cancel: string; add: string; close: string
    confirm: string; error: string; noData: string; active: string; inactive: string
    back: string; next: string; done: string; acknowledged: string; items: string
    perMonth: string; search: string; all: string; required: string
    showPw: string; hidePw: string; resetQr: string; viewSlip: string; noSlip: string
    approve: string; reject: string; refresh: string; addNew: string
    persons: string; table: string; seats: string; minutes: string
  }
  nav: {
    overview: string; menu: string; floor: string; kitchen: string; tableQr: string
    payments: string; promotions: string; employees: string; inventory: string
    reports: string; branches: string; settings: string; kds: string
  }
  sidebar: {
    system: string; branch: string; enterBranch: string; closed: string
    roleMgr: string; roleEmp: string; roleChef: string
    logout: string; logoutTitle: string; logoutMsg: string; logoutConfirm: string
    suspended: string; suspendReason: string; suspendContact: string
  }
  overview: {
    title: string; subtitle: string
    revenue7d: string; orders: string; avgPerOrder: string
    dailySales: string; bestseller: string; noData: string; quickLinks: string
  }
  orders: {
    title: string; subtitle: string
    tabFloor: string; tabReady: string; tabPayment: string
    available: string; occupied: string; reserved: string; cleaning: string
    unpaid: string; pendingVerif: string
    noTables: string; noReady: string; noPayment: string
    served: string; payCash: string; verifyTransfer: string; cancelItem: string
    customerSlip: string
    itemPending: string; itemCooking: string; itemReady: string; itemServed: string
  }
  kitchen: {
    subtitle: string; pending: string; cooking: string; ready: string
    acceptAll: string; startCooking: string; done: string; noOrders: string
  }
  payments: {
    title: string; loading: string; noPending: string; allVerified: string
    noSlipsPending: string; orderSlips: string; preorderSlips: string
    pendingVerif: string
  }
  menu: {
    title: string; addMenu: string; addCategory: string; manageCategories: string
    menuName: string; price: string; description: string; category: string
    image: string; noCategory: string; searchPlaceholder: string
    noResults: string; noMenuInCat: string; editMenu: string; addNewMenu: string
    uploading: string; changeImage: string; selectImage: string; imageHint: string
    catNewName: string; noCategories: string; uncategorized: string
    openSell: string; closeSell: string; deleteMenu: string; editing: string; saveChanges: string
    openCount: string; closedCount: string
  }
  employees: {
    title: string; activeCount: string; addEmployee: string
    editEmployee: string; addNewEmployee: string
    name: string; email: string; password: string; passwordEditHint: string
    salary: string; roleLabel: string
    roleMgr: string; roleEmp: string; roleChef: string
    suspend: string; activate: string; noEmployees: string; saveChanges: string
  }
  inventory: {
    title: string; addIngredient: string; lowStock: string; below: string
    addNew: string; ingredientName: string; unit: string; initialQty: string
    alertBelow: string; adding: string; noIngredients: string
    colName: string; colQty: string; colAlert: string
    recipe: string; selectIngredient: string; noRecipe: string
  }
  promotions: {
    title: string; createPromo: string; editPromo: string; createNew: string
    promoName: string; discountPct: string; discountAmt: string
    minOrder: string; startsAt: string; endsAt: string
    active: string; inactive: string; noPromos: string; saveChanges: string
  }
  branches: {
    title: string; createBranch: string
    isBranch: string; isBranchSub: string; goToParent: string
    limitReached: string; upgradeLink: string
    freeNotSupported: string; freeUpgradeSub: string; upgrade: string
    enterBranch: string; closeBranch: string; closedBadge: string
    closeBranchTitle: string
    createTitle: string; branchName: string; slugLabel: string; slugHint: string
    creating: string
  }
  settings: {
    title: string; subtitle: string
    planSection: string; currentPlan: string
    tablesUsed: string; menusUsed: string
    upgrade: string; maxPlan: string
    infoSection: string; restaurantName: string
    promptpayNum: string; promptpayHint: string
    contactEmail: string; contactEmailHint: string
    businessHours: string; openTime: string; closeTime: string
    saveInfo: string
    security: string; currentPw: string; newPw: string; newPwHint: string
    confirmPw: string; changePw: string; changing: string; changed: string
    upgradeTitle: string; selectPlan: string
    payMethod: string; promptpay: string; promptpaySub: string
    card: string; cardSub: string; transferAmount: string; toPromptpay: string
    note: string; attachSlip: string; tapSlip: string; removeSlip: string
    sending: string; submitSlip: string; amountDue: string
    cardName: string; cardNumber: string; expiry: string; processing: string
    successTitle: string; successMsg: string
    pendingTitle: string; pendingMsg: string
    planBasicFeatures: string[]; planProFeatures: string[]
  }
  reports: {
    title: string; subtitle: string; from: string; to: string
    viewReport: string; totalRevenue: string; orderCount: string; topMenu: string
    dailySales: string; bestseller: string; noData: string
    last7: string; last30: string; thisMonth: string
    csvDailySales: string; csvMenuTitle: string; csvRank: string
    csvQty: string; csvRevenue: string
  }
  tables: {
    title: string; subtitle: string; addTable: string
    tableLabel: string; seats: string; adding: string; noTables: string
    addNew: string; resetQr: string; resetQrTitle: string; resetQrMsg: string
    deleteTitle: string; reservations: string; noReservations: string
    reserveLink: string; seated: string; noShow: string
    paidAdvance: string; payFailed: string
    confirmed: string
  }
}

// ─── Thai ─────────────────────────────────────────────────────────────────────
const th: DashboardT = {
  common: {
    loading: 'กำลังโหลด...', save: 'บันทึก', saving: 'กำลังบันทึก...', saved: 'บันทึกแล้ว',
    edit: 'แก้ไข', delete: 'ลบ', cancel: 'ยกเลิก', add: 'เพิ่ม', close: 'ปิด',
    confirm: 'ยืนยัน', error: 'เกิดข้อผิดพลาด', noData: 'ยังไม่มีข้อมูล',
    active: 'ใช้งาน', inactive: 'ปิด', back: 'ย้อนกลับ', next: 'ถัดไป',
    done: 'เสร็จสิ้น', acknowledged: 'รับทราบ', items: 'รายการ', perMonth: '/เดือน',
    search: 'ค้นหา', all: 'ทั้งหมด', required: 'จำเป็น', showPw: 'แสดงรหัสผ่าน',
    hidePw: 'ซ่อนรหัสผ่าน', resetQr: 'รีเซ็ต QR', viewSlip: 'ดูสลิป', noSlip: 'ไม่มีสลิป',
    approve: 'อนุมัติ', reject: 'ปฏิเสธ', refresh: 'รีเฟรช', addNew: 'เพิ่มใหม่',
    persons: 'คน', table: 'โต๊ะ', seats: 'ที่นั่ง', minutes: 'นาที',
  },
  nav: {
    overview: 'ภาพรวม', menu: 'เมนู', floor: 'หน้าร้าน', kitchen: 'ครัว',
    tableQr: 'QR โต๊ะ', payments: 'ชำระเงิน', promotions: 'โปรโมชั่น',
    employees: 'พนักงาน', inventory: 'คลังวัตถุดิบ', reports: 'รายงาน',
    branches: 'สาขา', settings: 'ตั้งค่า', kds: 'KDS จอครัว ↗',
  },
  sidebar: {
    system: 'ระบบจัดการร้าน', branch: 'สาขา', enterBranch: 'เข้า →', closed: 'ปิด',
    roleMgr: 'ผู้จัดการ', roleEmp: 'พนักงาน', roleChef: 'พ่อครัว',
    logout: 'ออกจากระบบ', logoutTitle: 'ออกจากระบบ?',
    logoutMsg: 'คุณต้องการออกจากระบบใช่ไหม', logoutConfirm: 'ออกจากระบบ',
    suspended: 'ร้านนี้ถูกระงับการใช้งาน', suspendReason: 'เหตุผล',
    suspendContact: 'หากต้องการอุทธรณ์ กรุณาติดต่อทีมงาน',
  },
  overview: {
    title: 'ภาพรวมร้าน 👋', subtitle: 'สรุปผลประกอบการ 7 วันล่าสุด',
    revenue7d: 'รายได้ 7 วัน', orders: 'ออเดอร์', avgPerOrder: 'เฉลี่ย/ออเดอร์',
    dailySales: '📅 ยอดขายรายวัน', bestseller: '🔥 เมนูขายดี Top 10',
    noData: 'ยังไม่มีข้อมูล', quickLinks: 'เมนูด่วน',
  },
  orders: {
    title: '🪑 หน้าร้าน', subtitle: 'สถานะโต๊ะแบบเรียลไทม์',
    tabFloor: '🪑 ผังโต๊ะ', tabReady: '🔔 พร้อมเสิร์ฟ', tabPayment: '💳 ชำระเงิน',
    available: 'ว่าง', occupied: 'มีลูกค้า', reserved: 'จอง', cleaning: 'ทำความสะอาด',
    unpaid: 'รอชำระ', pendingVerif: 'มีสลิป รอยืนยัน',
    noTables: 'ไม่มีข้อมูลโต๊ะ', noReady: 'ไม่มีรายการรอเสิร์ฟ',
    noPayment: 'ไม่มีรายการรอชำระเงิน', served: 'เสิร์ฟแล้ว',
    payCash: 'ชำระสด', verifyTransfer: 'ยืนยันโอน', cancelItem: 'ยกเลิกรายการ',
    customerSlip: 'สลิปที่ลูกค้าส่งมา',
    itemPending: 'รอทำ', itemCooking: 'กำลังทำ', itemReady: 'พร้อม', itemServed: 'เสิร์ฟแล้ว',
  },
  kitchen: {
    subtitle: 'realtime', pending: 'รอทำ', cooking: 'กำลังทำ', ready: 'พร้อมเสิร์ฟ',
    acceptAll: 'รับทั้งหมด', startCooking: 'รับทำ', done: 'เสร็จ',
    noOrders: 'ไม่มีออเดอร์ค้าง พักได้เลย!',
  },
  payments: {
    title: 'ตรวจสอบชำระเงิน', loading: 'กำลังโหลด…', noPending: 'ไม่มีรายการรอตรวจสอบ',
    allVerified: 'ทุกรายการได้รับการตรวจสอบแล้ว', noSlipsPending: 'ไม่มีสลิปรอยืนยัน',
    orderSlips: 'สลิปโอนเงิน — ออเดอร์', preorderSlips: 'สลิป Pre-order — การจอง',
    pendingVerif: 'รอยืนยัน',
  },
  menu: {
    title: 'จัดการเมนู', addMenu: 'เพิ่มเมนู', addCategory: 'เพิ่ม', manageCategories: 'หมวดหมู่',
    menuName: 'ชื่อเมนู', price: 'ราคา (฿)', description: 'คำอธิบาย',
    category: 'หมวดหมู่', image: 'รูปภาพ', noCategory: '— ไม่ระบุ —',
    searchPlaceholder: 'ค้นหาเมนู...', noResults: 'ไม่พบเมนูที่ค้นหา',
    noMenuInCat: '🍽️ ยังไม่มีเมนูในหมวดนี้', editMenu: '✏️ แก้ไขเมนู',
    addNewMenu: 'เพิ่มเมนูใหม่', uploading: 'กำลังอัปโหลด...', changeImage: 'เปลี่ยนรูปภาพ',
    selectImage: 'เลือกรูปภาพ', imageHint: 'JPG, PNG ไม่เกิน 2MB',
    catNewName: 'ชื่อหมวดหมู่ใหม่', noCategories: 'ยังไม่มีหมวดหมู่',
    uncategorized: 'ไม่มีหมวดหมู่', openSell: 'เปิดขาย', closeSell: 'ปิดขาย',
    deleteMenu: 'ลบเมนู', editing: 'จัดการหมวดหมู่', saveChanges: 'บันทึกการแก้ไข',
    openCount: 'เปิดขาย', closedCount: 'ปิด',
  },
  employees: {
    title: '👥 พนักงาน', activeCount: 'คนกำลังทำงาน', addEmployee: 'เพิ่มคน',
    editEmployee: '✏️ แก้ไขพนักงาน', addNewEmployee: 'เพิ่มพนักงานใหม่',
    name: 'ชื่อ', email: 'อีเมล', password: 'รหัสผ่าน',
    passwordEditHint: '(เว้นว่างถ้าไม่เปลี่ยน)', salary: 'เงินเดือน (฿)', roleLabel: 'ตำแหน่ง',
    roleMgr: 'ผู้จัดการ', roleEmp: 'พนักงาน', roleChef: 'พ่อครัว',
    suspend: 'ระงับ', activate: 'เปิดใช้งาน', noEmployees: '👥 ยังไม่มีพนักงาน',
    saveChanges: 'บันทึกการแก้ไข',
  },
  inventory: {
    title: 'คลังวัตถุดิบ', addIngredient: 'เพิ่มวัตถุดิบ', lowStock: 'วัตถุดิบใกล้หมด',
    below: 'ต่ำกว่า', addNew: 'เพิ่มวัตถุดิบใหม่', ingredientName: 'ชื่อวัตถุดิบ',
    unit: 'หน่วย', initialQty: 'จำนวนเริ่มต้น', alertBelow: 'แจ้งเตือนเมื่อต่ำกว่า',
    adding: 'กำลังเพิ่ม...', noIngredients: 'ยังไม่มีวัตถุดิบ',
    colName: 'วัตถุดิบ', colQty: 'คงเหลือ', colAlert: 'แจ้งเตือน',
    recipe: 'Recipe (วัตถุดิบต่อเมนู)', selectIngredient: 'เลือกวัตถุดิบ', noRecipe: 'ยังไม่มี Recipe',
  },
  promotions: {
    title: '🎁 โปรโมชั่น', createPromo: 'สร้างโปรโมชั่น', editPromo: '✏️ แก้ไขโปรโมชั่น',
    createNew: 'สร้างโปรโมชั่นใหม่', promoName: 'ชื่อโปรโมชั่น',
    discountPct: 'ส่วนลด %', discountAmt: 'ส่วนลด ฿', minOrder: 'ขั้นต่ำ ฿',
    startsAt: 'เริ่ม', endsAt: 'สิ้นสุด', active: 'ใช้งาน', inactive: 'ปิด',
    noPromos: 'ยังไม่มีโปรโมชั่น', saveChanges: 'บันทึกการแก้ไข',
  },
  branches: {
    title: 'สาขา', createBranch: 'สร้างสาขา',
    isBranch: 'ร้านนี้เป็นสาขา', isBranchSub: 'การจัดการสาขาทำได้จากร้านหลักเท่านั้น',
    goToParent: 'ไปที่ร้านหลัก', limitReached: 'ถึงขีดจำกัดสาขาของแพ็กเกจแล้ว',
    upgradeLink: 'อัปเกรดแพ็กเกจ',
    freeNotSupported: 'แพ็กเกจ Free ไม่รองรับสาขา',
    freeUpgradeSub: 'อัปเกรดเป็น Basic หรือ Pro เพื่อสร้างสาขา',
    upgrade: 'อัปเกรดแพ็กเกจ', enterBranch: 'เข้า', closedBadge: 'ปิด',
    closeBranch: 'ปิดสาขา', closeBranchTitle: 'ปิดสาขา?',
    createTitle: 'สร้างสาขาใหม่', branchName: 'ชื่อสาขา',
    slugLabel: 'Slug (URL)', slugHint: 'ใช้เฉพาะ a-z, 0-9 และ -',
    creating: 'กำลังสร้าง...',
  },
  settings: {
    title: 'ตั้งค่า', subtitle: 'จัดการข้อมูลร้านและการใช้งาน',
    planSection: 'แพ็กเกจ', currentPlan: 'แพ็กเกจปัจจุบัน',
    tablesUsed: 'โต๊ะที่ใช้', menusUsed: 'เมนูที่ใช้',
    upgrade: 'อัปเกรดแพ็กเกจ', maxPlan: 'คุณใช้แพ็กเกจสูงสุดแล้ว',
    infoSection: 'ข้อมูลร้าน', restaurantName: 'ชื่อร้าน',
    promptpayNum: 'เลข PromptPay', promptpayHint: 'ใช้รับชำระเงินจากลูกค้าผ่าน QR code',
    contactEmail: 'อีเมลติดต่อ', contactEmailHint: 'รับการแจ้งเตือนจากระบบ เช่น การอัปเกรดแพ็กเกจ, แจ้งเตือนหมดอายุ',
    businessHours: 'เวลาทำการ', openTime: 'เปิด', closeTime: 'ปิด',
    saveInfo: 'บันทึกข้อมูลร้าน', security: 'ความปลอดภัย',
    currentPw: 'รหัสผ่านปัจจุบัน', newPw: 'รหัสผ่านใหม่', newPwHint: 'อย่างน้อย 6 ตัวอักษร',
    confirmPw: 'ยืนยันรหัสผ่านใหม่', changePw: 'เปลี่ยนรหัสผ่าน',
    changing: 'กำลังเปลี่ยน...', changed: 'เปลี่ยนแล้ว',
    upgradeTitle: 'อัปเกรดแพ็กเกจ', selectPlan: 'เลือกแพ็กเกจที่ต้องการ',
    payMethod: 'เลือกวิธีชำระเงิน', promptpay: 'PromptPay',
    promptpaySub: 'โอนแล้วแนบสลิป — อนุมัติภายใน 24 ชม.',
    card: 'บัตรเครดิต / เดบิต', cardSub: 'อัปเกรดทันที — Visa, Mastercard',
    transferAmount: 'โอนเงินจำนวน', toPromptpay: 'ไปยัง PromptPay',
    note: 'หมายเหตุ', attachSlip: 'แนบสลิปการโอน', tapSlip: 'แตะเพื่อเลือกรูปสลิป',
    removeSlip: 'ลบสลิป', sending: 'กำลังส่ง...', submitSlip: 'ส่งสลิปเพื่อตรวจสอบ',
    amountDue: 'ยอดชำระ', cardName: 'ชื่อบนบัตร', cardNumber: 'หมายเลขบัตร',
    expiry: 'วันหมดอายุ', processing: 'กำลังประมวลผล...',
    successTitle: 'อัปเกรดสำเร็จ!', successMsg: 'แพ็กเกจของคุณเปลี่ยนเป็น',
    pendingTitle: 'รอการตรวจสอบ',
    pendingMsg: 'ทีมงานจะตรวจสอบสลิปและอัปเกรดแพ็กเกจภายใน 24 ชั่วโมง',
    planBasicFeatures: ['โต๊ะสูงสุด 20 โต๊ะ', 'เมนูสูงสุด 100 รายการ', 'รายงานพื้นฐาน'],
    planProFeatures: ['โต๊ะไม่จำกัด', 'เมนูไม่จำกัด', 'รายงานขั้นสูง', 'ฟีเจอร์ทั้งหมด'],
  },
  reports: {
    title: 'รายงาน', subtitle: 'ยอดขายและสถิติร้าน',
    from: 'จากวันที่', to: 'ถึงวันที่', viewReport: 'ดูรายงาน',
    totalRevenue: 'รายได้รวม', orderCount: 'จำนวนออเดอร์', topMenu: 'เมนูขายดีสุด',
    dailySales: 'ยอดขายรายวัน', bestseller: 'เมนูขายดี Top 10', noData: 'ยังไม่มีข้อมูล',
    last7: '7 วัน', last30: '30 วัน', thisMonth: 'เดือนนี้',
    csvDailySales: 'ยอดขายรายวัน', csvMenuTitle: 'เมนูขายดี Top 10',
    csvRank: 'อันดับ', csvQty: 'จำนวน (ชิ้น)', csvRevenue: 'รายได้ (บาท)',
  },
  tables: {
    title: '📱 QR Code โต๊ะ', subtitle: 'ลูกค้าสแกนเพื่อสั่ง',
    addTable: 'เพิ่มโต๊ะ', tableLabel: 'ชื่อโต๊ะ', seats: 'ที่นั่ง',
    adding: 'กำลังเพิ่ม...', noTables: 'ยังไม่มีโต๊ะ', addNew: 'เพิ่มโต๊ะใหม่',
    resetQr: 'รีเซ็ต QR', resetQrTitle: 'รีเซ็ต QR ทุกโต๊ะ?',
    resetQrMsg: 'QR เก่าจะใช้ไม่ได้ทันที', deleteTitle: 'ลบโต๊ะ',
    reservations: 'การจองโต๊ะ', noReservations: 'ไม่มีการจองในวันนี้',
    reserveLink: 'ลิงก์จองสำหรับลูกค้า ↗', seated: 'เข้านั่ง', noShow: 'ไม่มา',
    paidAdvance: '✓ ชำระล่วงหน้าแล้ว', payFailed: '✗ ไม่ผ่านการชำระ',
    confirmed: 'ยืนยันแล้ว',
  },
}

// ─── English ───────────────────────────────────────────────────────────────────
const en: DashboardT = {
  common: {
    loading: 'Loading...', save: 'Save', saving: 'Saving...', saved: 'Saved',
    edit: 'Edit', delete: 'Delete', cancel: 'Cancel', add: 'Add', close: 'Close',
    confirm: 'Confirm', error: 'An error occurred', noData: 'No data yet',
    active: 'Active', inactive: 'Inactive', back: 'Back', next: 'Next',
    done: 'Done', acknowledged: 'Got it', items: 'items', perMonth: '/mo',
    search: 'Search', all: 'All', required: 'Required', showPw: 'Show password',
    hidePw: 'Hide password', resetQr: 'Reset QR', viewSlip: 'View Slip', noSlip: 'No Slip',
    approve: 'Approve', reject: 'Reject', refresh: 'Refresh', addNew: 'Add New',
    persons: 'guests', table: 'Table', seats: 'seats', minutes: 'min',
  },
  nav: {
    overview: 'Overview', menu: 'Menu', floor: 'Floor', kitchen: 'Kitchen',
    tableQr: 'Table QR', payments: 'Payments', promotions: 'Promotions',
    employees: 'Staff', inventory: 'Inventory', reports: 'Reports',
    branches: 'Branches', settings: 'Settings', kds: 'KDS Kitchen ↗',
  },
  sidebar: {
    system: 'Restaurant System', branch: 'Branch', enterBranch: 'Enter →', closed: 'Closed',
    roleMgr: 'Manager', roleEmp: 'Employee', roleChef: 'Chef',
    logout: 'Log out', logoutTitle: 'Log out?',
    logoutMsg: 'Are you sure you want to log out?', logoutConfirm: 'Log out',
    suspended: 'This restaurant is suspended', suspendReason: 'Reason',
    suspendContact: 'Contact our team to appeal',
  },
  overview: {
    title: 'Overview 👋', subtitle: 'Last 7 days summary',
    revenue7d: '7-Day Revenue', orders: 'Orders', avgPerOrder: 'Avg/Order',
    dailySales: '📅 Daily Sales', bestseller: '🔥 Top 10 Best Sellers',
    noData: 'No data yet', quickLinks: 'Quick Links',
  },
  orders: {
    title: '🪑 Floor', subtitle: 'Real-time table status',
    tabFloor: '🪑 Table Layout', tabReady: '🔔 Ready to Serve', tabPayment: '💳 Payment',
    available: 'Available', occupied: 'Occupied', reserved: 'Reserved', cleaning: 'Cleaning',
    unpaid: 'Unpaid', pendingVerif: 'Slip Received',
    noTables: 'No tables found', noReady: 'Nothing to serve',
    noPayment: 'No pending payments', served: 'Served',
    payCash: 'Pay Cash', verifyTransfer: 'Verify Transfer', cancelItem: 'Cancel Item',
    customerSlip: 'Customer Slip',
    itemPending: 'Pending', itemCooking: 'Cooking', itemReady: 'Ready', itemServed: 'Served',
  },
  kitchen: {
    subtitle: 'realtime', pending: 'Pending', cooking: 'Cooking', ready: 'Ready',
    acceptAll: 'Accept All', startCooking: 'Start', done: 'Done',
    noOrders: 'No pending orders. Take a break!',
  },
  payments: {
    title: 'Verify Payments', loading: 'Loading…', noPending: 'No pending items',
    allVerified: 'All items verified', noSlipsPending: 'No slips pending',
    orderSlips: 'Transfer Slips — Orders', preorderSlips: 'Pre-order Slips — Reservations',
    pendingVerif: 'Pending Verification',
  },
  menu: {
    title: 'Manage Menu', addMenu: 'Add Item', addCategory: 'Add', manageCategories: 'Categories',
    menuName: 'Menu Name', price: 'Price (฿)', description: 'Description',
    category: 'Category', image: 'Image', noCategory: '— None —',
    searchPlaceholder: 'Search menu...', noResults: 'No results found for',
    noMenuInCat: '🍽️ No items in this category', editMenu: '✏️ Edit Item',
    addNewMenu: 'Add New Item', uploading: 'Uploading...', changeImage: 'Change Image',
    selectImage: 'Select Image', imageHint: 'JPG, PNG max 2MB',
    catNewName: 'New category name', noCategories: 'No categories yet',
    uncategorized: 'Uncategorized', openSell: 'Available', closeSell: 'Unavailable',
    deleteMenu: 'Delete Item', editing: 'Manage Categories', saveChanges: 'Save Changes',
    openCount: 'available', closedCount: 'hidden',
  },
  employees: {
    title: '👥 Staff', activeCount: 'active',
    addEmployee: 'Add Staff', editEmployee: '✏️ Edit Staff', addNewEmployee: 'Add New Staff',
    name: 'Name', email: 'Email', password: 'Password',
    passwordEditHint: '(leave blank to keep current)', salary: 'Salary (฿)', roleLabel: 'Role',
    roleMgr: 'Manager', roleEmp: 'Employee', roleChef: 'Chef',
    suspend: 'Suspend', activate: 'Activate', noEmployees: '👥 No staff yet',
    saveChanges: 'Save Changes',
  },
  inventory: {
    title: 'Inventory', addIngredient: 'Add Ingredient', lowStock: 'Low Stock',
    below: 'below', addNew: 'Add New Ingredient', ingredientName: 'Ingredient Name',
    unit: 'Unit', initialQty: 'Initial Quantity', alertBelow: 'Alert When Below',
    adding: 'Adding...', noIngredients: 'No ingredients yet',
    colName: 'Ingredient', colQty: 'Stock', colAlert: 'Alert',
    recipe: 'Recipe (ingredients per item)', selectIngredient: 'Select ingredient', noRecipe: 'No recipe yet',
  },
  promotions: {
    title: '🎁 Promotions', createPromo: 'Create Promotion', editPromo: '✏️ Edit Promotion',
    createNew: 'Create New Promotion', promoName: 'Promotion Name',
    discountPct: 'Discount %', discountAmt: 'Discount ฿', minOrder: 'Min Order ฿',
    startsAt: 'Starts', endsAt: 'Ends', active: 'Active', inactive: 'Off',
    noPromos: 'No promotions yet', saveChanges: 'Save Changes',
  },
  branches: {
    title: 'Branches', createBranch: 'Create Branch',
    isBranch: 'This is a branch', isBranchSub: 'Branch management is done from the main restaurant',
    goToParent: 'Go to main restaurant', limitReached: 'Branch limit reached for your plan',
    upgradeLink: 'Upgrade plan',
    freeNotSupported: 'Free plan does not support branches',
    freeUpgradeSub: 'Upgrade to Basic or Pro to create branches',
    upgrade: 'Upgrade Plan', enterBranch: 'Enter', closedBadge: 'Closed',
    closeBranch: 'Close Branch', closeBranchTitle: 'Close Branch?',
    createTitle: 'Create New Branch', branchName: 'Branch Name',
    slugLabel: 'Slug (URL)', slugHint: 'Use only a-z, 0-9 and -',
    creating: 'Creating...',
  },
  settings: {
    title: 'Settings', subtitle: 'Manage restaurant info and preferences',
    planSection: 'Plan', currentPlan: 'Current Plan',
    tablesUsed: 'Tables Used', menusUsed: 'Menus Used',
    upgrade: 'Upgrade Plan', maxPlan: "You're on the highest plan",
    infoSection: 'Restaurant Info', restaurantName: 'Restaurant Name',
    promptpayNum: 'PromptPay Number', promptpayHint: 'Used for customer payments via QR code',
    contactEmail: 'Contact Email', contactEmailHint: 'Receive system notifications: upgrades, renewals, etc.',
    businessHours: 'Business Hours', openTime: 'Open', closeTime: 'Close',
    saveInfo: 'Save Restaurant Info', security: 'Security',
    currentPw: 'Current Password', newPw: 'New Password', newPwHint: 'At least 6 characters',
    confirmPw: 'Confirm New Password', changePw: 'Change Password',
    changing: 'Changing...', changed: 'Changed',
    upgradeTitle: 'Upgrade Plan', selectPlan: 'Select a plan',
    payMethod: 'Select payment method', promptpay: 'PromptPay',
    promptpaySub: 'Transfer and attach slip — approved within 24hrs',
    card: 'Credit / Debit Card', cardSub: 'Instant upgrade — Visa, Mastercard',
    transferAmount: 'Transfer Amount', toPromptpay: 'to PromptPay',
    note: 'Note', attachSlip: 'Attach Transfer Slip', tapSlip: 'Tap to select slip image',
    removeSlip: 'Remove Slip', sending: 'Sending...', submitSlip: 'Submit Slip for Review',
    amountDue: 'Amount Due', cardName: 'Name on Card', cardNumber: 'Card Number',
    expiry: 'Expiry Date', processing: 'Processing...',
    successTitle: 'Upgrade Successful!', successMsg: 'Your plan has been changed to',
    pendingTitle: 'Awaiting Review',
    pendingMsg: 'Our team will review your slip and upgrade your plan within 24 hours',
    planBasicFeatures: ['Up to 20 tables', 'Up to 100 menu items', 'Basic reports'],
    planProFeatures: ['Unlimited tables', 'Unlimited menu items', 'Advanced reports', 'All features'],
  },
  reports: {
    title: 'Reports', subtitle: 'Sales and restaurant stats',
    from: 'From', to: 'To', viewReport: 'View Report',
    totalRevenue: 'Total Revenue', orderCount: 'Orders', topMenu: 'Best Seller',
    dailySales: 'Daily Sales', bestseller: 'Top 10 Best Sellers', noData: 'No data yet',
    last7: '7 days', last30: '30 days', thisMonth: 'This month',
    csvDailySales: 'Daily Sales', csvMenuTitle: 'Top 10 Best Sellers',
    csvRank: 'Rank', csvQty: 'Qty', csvRevenue: 'Revenue (THB)',
  },
  tables: {
    title: '📱 Table QR Codes', subtitle: 'Customers scan to order',
    addTable: 'Add Table', tableLabel: 'Table Name', seats: 'Seats',
    adding: 'Adding...', noTables: 'No tables yet', addNew: 'Add New Table',
    resetQr: 'Reset QR', resetQrTitle: 'Reset all QR codes?',
    resetQrMsg: 'Existing QR codes will stop working immediately', deleteTitle: 'Delete Table',
    reservations: 'Table Reservations', noReservations: 'No reservations today',
    reserveLink: 'Reservation link for customers ↗', seated: 'Seated', noShow: 'No Show',
    paidAdvance: '✓ Paid in advance', payFailed: '✗ Payment failed',
    confirmed: 'Confirmed',
  },
}

// ─── Context ───────────────────────────────────────────────────────────────────
const DICT: Record<DashboardLang, DashboardT> = { th, en }
const STORAGE_KEY = 'dashboard-lang'

type DashboardLangCtx = { t: DashboardT; lang: DashboardLang; setLang: (l: DashboardLang) => void }
const DashboardLangContext = createContext<DashboardLangCtx>({ t: th, lang: 'th', setLang: () => {} })

export function DashboardLangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<DashboardLang>('th')

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as DashboardLang | null
    if (stored === 'en' || stored === 'th') setLangState(stored)
  }, [])

  function setLang(l: DashboardLang) {
    setLangState(l)
    localStorage.setItem(STORAGE_KEY, l)
  }

  return (
    <DashboardLangContext.Provider value={{ t: DICT[lang], lang, setLang }}>
      {children}
    </DashboardLangContext.Provider>
  )
}

export function useDashboardLang() {
  return useContext(DashboardLangContext)
}

export function DashboardLangToggle() {
  const { lang, setLang } = useDashboardLang()
  return (
    <button
      onClick={() => setLang(lang === 'th' ? 'en' : 'th')}
      className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-bg3 hover:bg-border text-muted hover:text-text transition-colors"
      aria-label={lang === 'th' ? 'Switch to English' : 'เปลี่ยนเป็นภาษาไทย'}
    >
      {lang === 'th' ? '🇬🇧 EN' : '🇹🇭 TH'}
    </button>
  )
}
