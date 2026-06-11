const RESEND_API_KEY  = process.env.RESEND_API_KEY
const FROM_EMAIL      = process.env.PLATFORM_EMAIL_FROM ?? 'noreply@restaurant-saas.com'
const PLATFORM_NAME   = 'Restaurant SaaS'

interface SendEmailOpts {
  to: string
  subject: string
  html: string
}

// Fire-and-forget — logs error but never throws
export function sendEmail(opts: SendEmailOpts): void {
  if (!RESEND_API_KEY || !opts.to) return

  fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_EMAIL, to: opts.to, subject: opts.subject, html: opts.html }),
  }).then(async res => {
    if (!res.ok) console.error('[email] Failed:', await res.text())
  }).catch(err => console.error('[email] Error:', err))
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function base(body: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f5f5f4;font-family:sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
  <tr><td style="background:#f97316;padding:24px 32px;">
    <p style="margin:0;color:#fff;font-size:20px;font-weight:700;">🍜 ${PLATFORM_NAME}</p>
  </td></tr>
  <tr><td style="padding:32px;">${body}</td></tr>
  <tr><td style="padding:16px 32px;background:#f5f5f4;border-top:1px solid #e7e5e4;">
    <p style="margin:0;font-size:12px;color:#78716c;">อีเมลนี้ส่งโดยอัตโนมัติ กรุณาอย่าตอบกลับ</p>
  </td></tr>
</table></td></tr></table></body></html>`
}

function heading(text: string) {
  return `<h2 style="margin:0 0 16px;font-size:22px;color:#1c1917;">${text}</h2>`
}

function para(text: string) {
  return `<p style="margin:0 0 12px;font-size:15px;color:#44403c;line-height:1.6;">${text}</p>`
}

function infoBox(rows: { label: string; value: string }[]) {
  const cells = rows.map(r =>
    `<tr><td style="padding:8px 12px;color:#78716c;font-size:13px;width:120px;">${r.label}</td>
     <td style="padding:8px 12px;font-size:13px;font-weight:600;color:#1c1917;">${r.value}</td></tr>`
  ).join('')
  return `<table style="background:#f5f5f4;border-radius:8px;width:100%;margin:16px 0;">${cells}</table>`
}

// ─── Templates ────────────────────────────────────────────────────────────────

export function tplEmailVerification(name: string, verifyUrl: string) {
  return {
    subject: '✉️ ยืนยัน Email เพื่อเปิดใช้งานร้านของคุณ — Restaurant SaaS',
    html: base(
      heading('ยืนยัน Email ของคุณ') +
      para(`สวัสดีครับ คุณ <strong>${name}</strong>`) +
      para('กรุณากดปุ่มด้านล่างเพื่อยืนยัน email และเปิดใช้งานบัญชีของคุณ') +
      `<div style="text-align:center;margin:28px 0;">
        <a href="${verifyUrl}" style="background:#f97316;color:#fff;text-decoration:none;padding:14px 36px;border-radius:12px;font-weight:700;font-size:16px;display:inline-block;">ยืนยัน Email</a>
      </div>` +
      para('หรือคัดลอกลิงก์นี้ไปวางในเบราว์เซอร์:') +
      `<p style="margin:0 0 16px;font-size:12px;color:#78716c;word-break:break-all;">${verifyUrl}</p>` +
      para('ลิงก์จะหมดอายุใน <strong>24 ชั่วโมง</strong>') +
      para('<span style="color:#78716c;font-size:13px;">หากคุณไม่ได้สมัครใช้งาน กรุณาเพิกเฉยต่ออีเมลนี้</span>')
    ),
  }
}

export function tplPaymentApproved(restaurantName: string, plan: string, expiresAt: Date) {
  return {
    subject: `✅ อนุมัติการอัปเกรดแพ็กเกจ ${plan.toUpperCase()} — ${restaurantName}`,
    html: base(
      heading('การอัปเกรดได้รับการอนุมัติแล้ว') +
      para(`ยินดีด้วย! ร้าน <strong>${restaurantName}</strong> ได้รับการอัปเกรดแพ็กเกจเรียบร้อยแล้ว`) +
      infoBox([
        { label: 'แพ็กเกจ', value: plan.toUpperCase() },
        { label: 'หมดอายุ', value: expiresAt.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }) },
      ]) +
      para('คุณสามารถเริ่มใช้งานฟีเจอร์ใหม่ได้ทันที')
    ),
  }
}

export function tplPaymentRejected(restaurantName: string, plan: string, note?: string) {
  return {
    subject: `❌ คำขออัปเกรดแพ็กเกจถูกปฏิเสธ — ${restaurantName}`,
    html: base(
      heading('คำขออัปเกรดถูกปฏิเสธ') +
      para(`คำขออัปเกรดแพ็กเกจ <strong>${plan.toUpperCase()}</strong> ของร้าน <strong>${restaurantName}</strong> ถูกปฏิเสธ`) +
      (note ? infoBox([{ label: 'เหตุผล', value: note }]) : '') +
      para('หากมีข้อสงสัย กรุณาติดต่อทีมงาน หรือลองส่งคำขออีกครั้ง')
    ),
  }
}

export function tplPlanExpiringSoon(restaurantName: string, plan: string, expiresAt: Date, daysLeft: number) {
  return {
    subject: `⚠️ แพ็กเกจ ${plan.toUpperCase()} จะหมดอายุใน ${daysLeft} วัน — ${restaurantName}`,
    html: base(
      heading(`แพ็กเกจของคุณจะหมดอายุใน ${daysLeft} วัน`) +
      para(`ร้าน <strong>${restaurantName}</strong> — แพ็กเกจ <strong>${plan.toUpperCase()}</strong> จะหมดอายุในวันที่ ${expiresAt.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}`) +
      para('กรุณาต่ออายุเพื่อคงสิทธิ์การใช้งานทุกฟีเจอร์ไว้ต่อเนื่อง') +
      para('หากไม่ต่ออายุ แพ็กเกจจะถูกปรับลงเป็น <strong>Free</strong> โดยอัตโนมัติ')
    ),
  }
}

export function tplPlanDowngraded(restaurantName: string, previousPlan: string) {
  return {
    subject: `ℹ️ แพ็กเกจถูกปรับลงเป็น Free — ${restaurantName}`,
    html: base(
      heading('แพ็กเกจถูกปรับลงเป็น Free') +
      para(`ร้าน <strong>${restaurantName}</strong> — แพ็กเกจ <strong>${previousPlan.toUpperCase()}</strong> หมดอายุแล้ว ระบบได้ปรับลงเป็น <strong>Free</strong> โดยอัตโนมัติ`) +
      para('คุณยังสามารถใช้งานฟีเจอร์พื้นฐานได้ตามปกติ หากต้องการฟีเจอร์เพิ่มเติม กรุณาอัปเกรดแพ็กเกจได้ที่เมนูตั้งค่า')
    ),
  }
}
