import { test, expect } from '@playwright/test'

const API = 'http://localhost:3010'
const SLUG = 'demo-restaurant'

// Helper: login and return JWT token
async function loginAs(request: any, email: string, password = 'password123') {
  const res = await request.post(`${API}/auth/login`, { data: { email, password } })
  const body = await res.json()
  return body.token as string
}

// Helper: get first table with qr_token
async function getFirstTable(request: any, token: string) {
  const res = await request.get(`${API}/tables`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const tables = await res.json()
  return tables[0] as { id: string; qr_token: string; label: string; restaurant_id: string }
}

// Helper: place an order via API (customer flow — no auth)
async function placeOrder(request: any, restaurantId: string, tableId: string) {
  const authRes = await request.post(`${API}/auth/customer`, {
    data: { name: 'E2E Tester', phone: '0891234567' },
  })
  const { token } = await authRes.json()

  const menuRes = await request.get(`${API}/menus?restaurantId=${restaurantId}`)
  const menus = await menuRes.json()
  const firstItem = menus[0]

  const orderRes = await request.post(`${API}/orders`, {
    data: {
      restaurantId,
      tableId,
      items: [{ menu_id: firstItem.id, menu_name: firstItem.name, quantity: 1, unit_price: firstItem.price }],
    },
    headers: { Authorization: `Bearer ${token}` },
  })
  const { orderId } = await orderRes.json()
  return orderId as string
}

test.describe('Customer — Order page', () => {
  test('order page loads menu items', async ({ page, request }) => {
    const token = await loginAs(request, 'employee1@demo.com')
    const table = await getFirstTable(request, token)

    await page.goto(`/r/${SLUG}/table/${table.qr_token}/order`)
    await page.waitForLoadState('networkidle')

    // At least one "เพิ่ม" button should be visible (menu item card)
    await expect(page.getByRole('button', { name: 'เพิ่ม' }).first()).toBeVisible({ timeout: 10_000 })
    // Header shows table label
    await expect(page.getByText(table.label)).toBeVisible()
  })

  test('adding item activates cart button', async ({ page, request }) => {
    const token = await loginAs(request, 'employee1@demo.com')
    const table = await getFirstTable(request, token)

    await page.goto(`/r/${SLUG}/table/${table.qr_token}/order`)
    await page.waitForLoadState('networkidle')

    // Initially cart is disabled
    const disabledBtn = page.getByRole('button', { name: /เลือกรายการอาหาร/i })
    await expect(disabledBtn).toBeVisible()

    // Click first "เพิ่ม" to add one item
    await page.getByRole('button', { name: 'เพิ่ม' }).first().click()

    // Cart button should now show quantity "1" and total
    await expect(page.getByRole('button', { name: /สั่งอาหาร · ฿/i })).toBeVisible({ timeout: 5000 })
  })

  test('full order flow: add item → fill info → place order', async ({ page, request }) => {
    const token = await loginAs(request, 'employee1@demo.com')
    const table = await getFirstTable(request, token)

    await page.goto(`/r/${SLUG}/table/${table.qr_token}/order`)
    await page.waitForLoadState('networkidle')

    // Add first item
    await page.getByRole('button', { name: 'เพิ่ม' }).first().click()

    // Open cart sheet
    await page.getByRole('button', { name: /สั่งอาหาร · ฿/i }).click()

    // Fill customer info
    await page.getByPlaceholder('สมชาย ใจดี').fill('E2E Customer')
    await page.getByPlaceholder('0XX-XXX-XXXX').fill('0891234567')

    // Submit order
    await page.getByRole('button', { name: /สั่งอาหาร · ฿/i }).last().click()

    // Should navigate to payment page
    await page.waitForURL(`/r/${SLUG}/table/${table.qr_token}/payment`, { timeout: 10_000 })
    expect(page.url()).toContain('/payment')
  })
})

test.describe('Kitchen Display System', () => {
  test('KDS page loads and shows status labels', async ({ page, request }) => {
    // Place an order via API so the kitchen has something to display
    const empToken = await loginAs(request, 'employee1@demo.com')
    const table = await getFirstTable(request, empToken)
    await placeOrder(request, table.restaurant_id, table.id)

    // Login as chef via UI — this sets the httpOnly session cookie required by middleware
    await page.goto('/login')
    await page.getByPlaceholder('you@example.com').fill('chef1@demo.com')
    await page.getByPlaceholder('••••••••').fill('password123')
    await page.getByRole('button', { name: /เข้าสู่ระบบ/i }).click()
    await page.waitForURL(/\/dashboard\/.+\/kitchen/, { timeout: 10_000 })

    // Navigate to standalone KDS display
    await page.goto(`/kds/${SLUG}`)
    await page.waitForLoadState('networkidle')

    // KDS always renders status summary labels regardless of order count
    // Use .first() since the same label appears in both stats header and order cards
    await expect(page.getByText('รอทำ').first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('กำลังทำ').first()).toBeVisible()
    await expect(page.getByText('พร้อมเสิร์ฟ').first()).toBeVisible()
  })
})

test.describe('Staff Dashboard', () => {
  test('authenticated employee can access dashboard orders page', async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder('you@example.com').fill('employee1@demo.com')
    await page.getByPlaceholder('••••••••').fill('password123')
    await page.getByRole('button', { name: /เข้าสู่ระบบ/i }).click()
    await page.waitForURL(/\/dashboard\/.+\/orders/, { timeout: 10_000 })
    await page.waitForLoadState('networkidle')

    // The orders page has h1 "🪑 หน้าร้าน" and a tab "🪑 ผังโต๊ะ"
    await expect(page.getByRole('heading', { name: /หน้าร้าน/ })).toBeVisible({ timeout: 10_000 })
  })
})
