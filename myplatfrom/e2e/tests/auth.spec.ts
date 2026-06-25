import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:3010'

// Login page UI + auth flow
test.describe('Login', () => {
  test('renders email and password fields', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible()
    await expect(page.getByPlaceholder('••••••••')).toBeVisible()
    await expect(page.getByRole('button', { name: /เข้าสู่ระบบ/i })).toBeVisible()
  })

  test('wrong credentials shows error', async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder('you@example.com').fill('nobody@example.com')
    await page.getByPlaceholder('••••••••').fill('wrongpass')
    await page.getByRole('button', { name: /เข้าสู่ระบบ/i }).click()
    // Error message should appear (any non-success text)
    await expect(page.locator('.bg-rose\\/10, [class*="rose"]').first()).toBeVisible({ timeout: 8000 })
  })

  test('employee login redirects to dashboard orders', async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder('you@example.com').fill('employee1@demo.com')
    await page.getByPlaceholder('••••••••').fill('password123')
    await page.getByRole('button', { name: /เข้าสู่ระบบ/i }).click()
    await page.waitForURL(/\/dashboard\/.+\/orders/, { timeout: 10_000 })
    expect(page.url()).toMatch(/\/dashboard\/demo-restaurant\/orders/)
  })

  test('chef login redirects to kitchen page', async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder('you@example.com').fill('chef1@demo.com')
    await page.getByPlaceholder('••••••••').fill('password123')
    await page.getByRole('button', { name: /เข้าสู่ระบบ/i }).click()
    await page.waitForURL(/\/dashboard\/.+\/kitchen|\/kds\//, { timeout: 10_000 })
    expect(page.url()).toMatch(/kitchen/)
  })

  test('unprotected dashboard redirects to login', async ({ page }) => {
    await page.goto('/dashboard/demo-restaurant')
    await page.waitForURL(/\/login/, { timeout: 6000 })
    expect(page.url()).toMatch(/\/login/)
  })
})

// Register page UI
test.describe('Register', () => {
  test('renders all required fields', async ({ page }) => {
    await page.goto('/register')
    await expect(page.getByPlaceholder('ร้านอร่อยริมทาง')).toBeVisible()
    await expect(page.getByPlaceholder('my-restaurant')).toBeVisible()
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible()
    await expect(page.getByPlaceholder('••••••••')).toBeVisible()
  })

  test('successful submit shows email verification prompt', async ({ page }) => {
    // Use a unique slug per run to avoid conflicts
    const slug = `e2e-test-${Date.now()}`
    await page.goto('/register')
    await page.getByPlaceholder('ร้านอร่อยริมทาง').fill('E2E Test Restaurant')
    await page.getByPlaceholder('my-restaurant').fill(slug)
    await page.getByPlaceholder('สมชาย ใจดี').fill('Test Manager')
    await page.getByPlaceholder('you@example.com').fill(`${slug}@example.com`)
    await page.getByPlaceholder('••••••••').fill('password123')
    // Submit button text is "สร้างร้านอาหาร"
    await page.getByRole('button', { name: /สร้างร้านอาหาร/i }).click()

    // Should show the "verify email" success screen
    await expect(page.getByText(/ยืนยัน Email/i)).toBeVisible({ timeout: 10_000 })
  })
})
