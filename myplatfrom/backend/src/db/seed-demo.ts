/**
 * Demo seed — เติมข้อมูลจำลองทุกฟีเจอร์ให้เหมือนใช้จริง
 * bun run src/db/seed-demo.ts
 */
import { db } from './index'
import {
  restaurants, users, tables, categories, menus, ingredients, menuIngredients,
  promotions, orders, orderItems, reservations, customers, pointTransactions,
  attendance, salaryPayments,
} from './schema'
import { eq, and } from 'drizzle-orm'
import bcrypt from 'bcryptjs'

const SLUG = 'demo-restaurant'

// ─── helpers ─────────────────────────────────────────────────────────────────
function daysAgo(n: number, h = 12, m = 0) {
  const d = new Date(); d.setDate(d.getDate() - n)
  d.setHours(h, m, 0, 0); return d
}
function todayAt(h: number, m = 0) {
  const d = new Date(); d.setHours(h, m, 0, 0); return d
}
function tomorrowAt(h: number, m = 0) {
  const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(h, m, 0, 0); return d
}
function pick<T>(arr: T[]) { return arr[Math.floor(Math.random() * arr.length)] }
function rand(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min }

// ─── main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🌱 เริ่ม seed ข้อมูลจำลอง...\n')

  // ── 1. ดึง restaurant ──────────────────────────────────────────────────────
  const [restaurant] = await db.select().from(restaurants).where(eq(restaurants.slug, SLUG)).limit(1)
  if (!restaurant) { console.error('❌ ไม่พบ demo-restaurant'); process.exit(1) }
  const RID = restaurant.id
  console.log(`✅ Restaurant: ${restaurant.name} (${RID})`)

  // ── 2. ล้างข้อมูลเก่า (ไม่แตะ users/tables/restaurant) ───────────────────
  console.log('🗑️  ล้างข้อมูลเก่า...')
  await db.delete(pointTransactions).where(eq(pointTransactions.restaurant_id, RID))
  await db.delete(customers).where(eq(customers.restaurant_id, RID))
  await db.delete(reservations).where(eq(reservations.restaurant_id, RID))
  await db.delete(orderItems).where(
    eq(orderItems.order_id,
      db.select({ id: orders.id }).from(orders).where(eq(orders.restaurant_id, RID)).limit(1) as any
    )
  ).catch(() => {})
  // ลบ order_items ผ่าน orders
  const existingOrders = await db.select({ id: orders.id }).from(orders).where(eq(orders.restaurant_id, RID))
  for (const o of existingOrders) {
    await db.delete(orderItems).where(eq(orderItems.order_id, o.id))
  }
  await db.delete(orders).where(eq(orders.restaurant_id, RID))
  await db.delete(menuIngredients).where(
    eq(menuIngredients.menu_id,
      db.select({ id: menus.id }).from(menus).where(eq(menus.restaurant_id, RID)).limit(1) as any
    )
  ).catch(() => {})
  await db.delete(menus).where(eq(menus.restaurant_id, RID))
  await db.delete(categories).where(eq(categories.restaurant_id, RID))
  await db.delete(ingredients).where(eq(ingredients.restaurant_id, RID))
  await db.delete(promotions).where(eq(promotions.restaurant_id, RID))
  await db.delete(attendance).where(eq(attendance.restaurant_id, RID))
  await db.delete(salaryPayments).where(eq(salaryPayments.restaurant_id, RID))

  // ── 3. tables ──────────────────────────────────────────────────────────────
  const allTables = await db.select().from(tables).where(eq(tables.restaurant_id, RID))
  if (!allTables.length) { console.error('❌ ไม่พบโต๊ะ ต้อง generate QR ก่อน'); process.exit(1) }
  console.log(`✅ Tables: ${allTables.length} โต๊ะ`)

  // reset table status
  await db.update(tables).set({ status: 'available' }).where(eq(tables.restaurant_id, RID))

  // ── 4. categories & menus ─────────────────────────────────────────────────
  console.log('🍽️  เพิ่ม categories & menus...')
  const [catMain, catRice, catSnack, catDrink, catDessert] = await db.insert(categories).values([
    { restaurant_id: RID, name: 'อาหารจานหลัก', sort_order: 1 },
    { restaurant_id: RID, name: 'ข้าว & เส้น',   sort_order: 2 },
    { restaurant_id: RID, name: 'ของทานเล่น',    sort_order: 3 },
    { restaurant_id: RID, name: 'เครื่องดื่ม',   sort_order: 4 },
    { restaurant_id: RID, name: 'ของหวาน',       sort_order: 5 },
  ]).returning()

  const menuData = await db.insert(menus).values([
    // อาหารจานหลัก
    { restaurant_id: RID, category_id: catMain.id, name: 'ต้มยำกุ้ง',           description: 'ต้มยำกุ้งแม่น้ำ รสจัด หอมตะไคร้',    price: 180, sort_order: 1 },
    { restaurant_id: RID, category_id: catMain.id, name: 'แกงเขียวหวานไก่',     description: 'แกงเขียวหวานใส่มะเขือ กะทิเข้มข้น',  price: 160, sort_order: 2 },
    { restaurant_id: RID, category_id: catMain.id, name: 'ผัดกะเพราหมูสับ',     description: 'หมูสับผัดกะเพราไฟแดง ใส่ไข่ดาว',      price: 90,  sort_order: 3 },
    { restaurant_id: RID, category_id: catMain.id, name: 'ต้มข่าไก่',           description: 'ต้มข่าไก่กะทิสด หอมข่าตะไคร้',        price: 150, sort_order: 4 },
    { restaurant_id: RID, category_id: catMain.id, name: 'ยำวุ้นเส้น',          description: 'ยำวุ้นเส้นกุ้งสด รสเปรี้ยวหวานเผ็ด',  price: 130, sort_order: 5 },
    { restaurant_id: RID, category_id: catMain.id, name: 'ปลาราดพริก',          description: 'ปลากะพงทอดราดพริกสามรส',               price: 220, sort_order: 6 },
    { restaurant_id: RID, category_id: catMain.id, name: 'หมูตุ๋นพะโล้',        description: 'หมูพะโล้ตุ๋นนุ่ม หอมห้าเครื่อง',       price: 140, sort_order: 7 },
    // ข้าว & เส้น
    { restaurant_id: RID, category_id: catRice.id, name: 'ข้าวผัดกุ้ง',         description: 'ข้าวผัดกุ้งสดใส่ไข่ หอมมะนาว',          price: 110, sort_order: 1 },
    { restaurant_id: RID, category_id: catRice.id, name: 'ผัดไทยกุ้งสด',        description: 'ผัดไทยเส้นจันทน์ กุ้งแม่น้ำสด',         price: 130, sort_order: 2 },
    { restaurant_id: RID, category_id: catRice.id, name: 'ข้าวมันไก่',           description: 'ข้าวมันไก่ต้ม น้ำซุปใส ซอสพิเศษ',       price: 80,  sort_order: 3 },
    { restaurant_id: RID, category_id: catRice.id, name: 'ราดหน้าหมูกรอบ',      description: 'เส้นใหญ่ราดหน้าหมูกรอบ ซอสหอย',         price: 90,  sort_order: 4 },
    { restaurant_id: RID, category_id: catRice.id, name: 'ข้าวหน้าเป็ดพะโล้',   description: 'ข้าวหน้าเป็ดพะโล้ ผักดองเปรี้ยว',       price: 110, sort_order: 5 },
    // ของทานเล่น
    { restaurant_id: RID, category_id: catSnack.id, name: 'ปอเปี๊ยะทอด',        description: 'ปอเปี๊ยะไส้หมูกรอบ ซอสหวาน',            price: 80,  sort_order: 1 },
    { restaurant_id: RID, category_id: catSnack.id, name: 'ไข่เจียวหมูสับ',     description: 'ไข่เจียวฟูหอม ราดน้ำปลา',                price: 70,  sort_order: 2 },
    { restaurant_id: RID, category_id: catSnack.id, name: 'ทอดมันกุ้ง',         description: 'ทอดมันกุ้งสด ซอสพริกหวาน',               price: 120, sort_order: 3 },
    { restaurant_id: RID, category_id: catSnack.id, name: 'ลาบหมูสด',           description: 'ลาบหมูอีสาน เผ็ดจี๊ด หอมข้าวคั่ว',      price: 110, sort_order: 4 },
    // เครื่องดื่ม
    { restaurant_id: RID, category_id: catDrink.id, name: 'น้ำเปล่า',           description: '',                                       price: 15,  sort_order: 1 },
    { restaurant_id: RID, category_id: catDrink.id, name: 'โค้ก / เป๊บซี่',     description: 'น้ำอัดลม กระป๋อง 325ml',                price: 35,  sort_order: 2 },
    { restaurant_id: RID, category_id: catDrink.id, name: 'ชาเย็น',             description: 'ชาไทยเย็น นมสด',                         price: 45,  sort_order: 3 },
    { restaurant_id: RID, category_id: catDrink.id, name: 'กาแฟเย็น',           description: 'กาแฟโบราณเย็น นมข้น',                    price: 55,  sort_order: 4 },
    { restaurant_id: RID, category_id: catDrink.id, name: 'น้ำส้มคั้นสด',       description: 'น้ำส้มคั้นสด ไม่ผสมน้ำ',                 price: 65,  sort_order: 5 },
    { restaurant_id: RID, category_id: catDrink.id, name: 'ลิ้นจี่ปั่น',         description: 'ลิ้นจี่ปั่นกับนมสด หวานเย็น',             price: 75,  sort_order: 6 },
    // ของหวาน
    { restaurant_id: RID, category_id: catDessert.id, name: 'ข้าวเหนียวมะม่วง', description: 'ข้าวเหนียวมูนกะทิ มะม่วงสุกหวาน',       price: 90,  sort_order: 1 },
    { restaurant_id: RID, category_id: catDessert.id, name: 'บัวลอยน้ำขิง',     description: 'บัวลอยหลากสี น้ำขิงร้อน',               price: 65,  sort_order: 2 },
    { restaurant_id: RID, category_id: catDessert.id, name: 'เค้กช็อกโกแลต',    description: 'เค้กช็อกโกแลตฟองดอง ไอศกรีม',           price: 120, sort_order: 3 },
  ]).returning()

  console.log(`  ✅ ${menuData.length} รายการเมนู`)

  // ── 5. ingredients ─────────────────────────────────────────────────────────
  console.log('📦 เพิ่ม ingredients...')
  const ingData = await db.insert(ingredients).values([
    { restaurant_id: RID, name: 'หมูสับ',       unit: 'กก.',  quantity: 15,   low_threshold: 3 },
    { restaurant_id: RID, name: 'กุ้งแม่น้ำ',   unit: 'กก.',  quantity: 8,    low_threshold: 2 },
    { restaurant_id: RID, name: 'ไก่',           unit: 'กก.',  quantity: 20,   low_threshold: 5 },
    { restaurant_id: RID, name: 'เส้นใหญ่',     unit: 'กก.',  quantity: 10,   low_threshold: 3 },
    { restaurant_id: RID, name: 'ข้าวสาร',      unit: 'กก.',  quantity: 50,   low_threshold: 10 },
    { restaurant_id: RID, name: 'น้ำมันพืช',    unit: 'ลิตร', quantity: 12,   low_threshold: 3 },
    { restaurant_id: RID, name: 'กะทิ',         unit: 'กระป๋อง', quantity: 24, low_threshold: 6 },
    { restaurant_id: RID, name: 'ตะไคร้',       unit: 'กก.',  quantity: 3,    low_threshold: 1 },
    { restaurant_id: RID, name: 'ใบกะเพรา',     unit: 'กก.',  quantity: 2,    low_threshold: 0.5 },
    { restaurant_id: RID, name: 'มะม่วงสุก',    unit: 'ผล',   quantity: 30,   low_threshold: 10 },
    { restaurant_id: RID, name: 'ไข่ไก่',       unit: 'ฟอง',  quantity: 120,  low_threshold: 30 },
    { restaurant_id: RID, name: 'ผักบุ้ง',      unit: 'กก.',  quantity: 5,    low_threshold: 1 },
    { restaurant_id: RID, name: 'พริกแดง',      unit: 'กก.',  quantity: 2,    low_threshold: 0.5 },
    { restaurant_id: RID, name: 'แป้งสาลี',     unit: 'กก.',  quantity: 8,    low_threshold: 2 },
    { restaurant_id: RID, name: 'ปลากะพง',      unit: 'กก.',  quantity: 6,    low_threshold: 2 },
  ]).returning()
  console.log(`  ✅ ${ingData.length} วัตถุดิบ`)

  // menu_ingredients สำหรับเมนูหลัก
  const menuByName = Object.fromEntries(menuData.map(m => [m.name, m]))
  const ingByName  = Object.fromEntries(ingData.map(i => [i.name, i]))

  await db.insert(menuIngredients).values([
    { menu_id: menuByName['ผัดกะเพราหมูสับ'].id, ingredient_id: ingByName['หมูสับ'].id,    quantity_per_unit: 0.2 },
    { menu_id: menuByName['ผัดกะเพราหมูสับ'].id, ingredient_id: ingByName['ใบกะเพรา'].id,  quantity_per_unit: 0.05 },
    { menu_id: menuByName['ผัดกะเพราหมูสับ'].id, ingredient_id: ingByName['ไข่ไก่'].id,    quantity_per_unit: 1 },
    { menu_id: menuByName['ต้มยำกุ้ง'].id,        ingredient_id: ingByName['กุ้งแม่น้ำ'].id, quantity_per_unit: 0.3 },
    { menu_id: menuByName['ต้มยำกุ้ง'].id,        ingredient_id: ingByName['ตะไคร้'].id,    quantity_per_unit: 0.05 },
    { menu_id: menuByName['แกงเขียวหวานไก่'].id,  ingredient_id: ingByName['ไก่'].id,       quantity_per_unit: 0.25 },
    { menu_id: menuByName['แกงเขียวหวานไก่'].id,  ingredient_id: ingByName['กะทิ'].id,      quantity_per_unit: 0.5 },
    { menu_id: menuByName['ข้าวผัดกุ้ง'].id,       ingredient_id: ingByName['กุ้งแม่น้ำ'].id, quantity_per_unit: 0.15 },
    { menu_id: menuByName['ข้าวผัดกุ้ง'].id,       ingredient_id: ingByName['ข้าวสาร'].id,   quantity_per_unit: 0.2 },
    { menu_id: menuByName['ข้าวผัดกุ้ง'].id,       ingredient_id: ingByName['ไข่ไก่'].id,    quantity_per_unit: 1 },
    { menu_id: menuByName['ปลาราดพริก'].id,        ingredient_id: ingByName['ปลากะพง'].id,   quantity_per_unit: 0.5 },
    { menu_id: menuByName['ปลาราดพริก'].id,        ingredient_id: ingByName['พริกแดง'].id,   quantity_per_unit: 0.05 },
    { menu_id: menuByName['ข้าวเหนียวมะม่วง'].id, ingredient_id: ingByName['มะม่วงสุก'].id,  quantity_per_unit: 1 },
    { menu_id: menuByName['ข้าวเหนียวมะม่วง'].id, ingredient_id: ingByName['กะทิ'].id,      quantity_per_unit: 0.25 },
  ])
  console.log('  ✅ menu_ingredients')

  // ── 6. promotions ──────────────────────────────────────────────────────────
  console.log('🎁 เพิ่ม promotions...')
  await db.insert(promotions).values([
    {
      restaurant_id: RID, name: 'ลด 10% เมื่อสั่งครบ 300',
      discount_pct: 10, min_order: 300, is_active: true,
      starts_at: daysAgo(30), ends_at: tomorrowAt(23, 59),
    },
    {
      restaurant_id: RID, name: 'Happy Hour ลด ฿50 (14:00-17:00)',
      discount_amt: 50, min_order: 200, is_active: true,
      starts_at: daysAgo(14), ends_at: tomorrowAt(23, 59),
    },
    {
      restaurant_id: RID, name: 'ส่วนลดวันเกิด ฿100',
      discount_amt: 100, min_order: 400, is_active: false,
      starts_at: daysAgo(60), ends_at: daysAgo(1),
    },
  ])
  console.log('  ✅ 3 โปรโมชั่น')

  // ── 7. users (employees) ───────────────────────────────────────────────────
  const allUsers = await db.select().from(users).where(eq(users.restaurant_id, RID))
  const manager  = allUsers.find(u => u.role === 'manager')
  const emps     = allUsers.filter(u => u.role === 'employee')
  const chefs    = allUsers.filter(u => u.role === 'chef')
  if (!manager) { console.error('❌ ไม่พบ manager'); process.exit(1) }
  console.log(`✅ Staff: manager=${manager.name}, ${emps.length} emp, ${chefs.length} chef`)

  // update salaries
  for (const u of allUsers) {
    const salary = u.role === 'manager' ? 35000 : u.role === 'chef' ? 22000 : 18000
    await db.update(users).set({ salary }).where(eq(users.id, u.id))
  }

  // ── 8. attendance (30 วัน) ─────────────────────────────────────────────────
  console.log('📅 เพิ่ม attendance...')
  const staffForAtt = [...emps, ...chefs]
  const attRows: any[] = []
  for (let d = 29; d >= 0; d--) {
    for (const staff of staffForAtt) {
      if (Math.random() < 0.1) continue // 10% ขาด
      const checkIn = daysAgo(d, rand(8, 9), rand(0, 30))
      const checkOut = new Date(checkIn.getTime() + rand(7, 9) * 3_600_000)
      const hours = (checkOut.getTime() - checkIn.getTime()) / 3_600_000
      attRows.push({ user_id: staff.id, restaurant_id: RID, date: checkIn.toISOString().slice(0, 10), check_in: checkIn, check_out: checkOut, hours_worked: hours })
    }
  }
  for (let i = 0; i < attRows.length; i += 50) {
    await db.insert(attendance).values(attRows.slice(i, i + 50))
  }
  console.log(`  ✅ ${attRows.length} attendance records`)

  // ── 9. salary payments ─────────────────────────────────────────────────────
  const months = ['2026-03', '2026-04', '2026-05']
  for (const month of months) {
    for (const staff of staffForAtt) {
      const salary = staff.role === 'chef' ? 22000 : 18000
      await db.insert(salaryPayments).values({
        user_id: staff.id, restaurant_id: RID, amount: salary, month,
        paid_by: manager.id, paid_at: new Date(`${month}-28T10:00:00`),
      })
    }
  }
  console.log('  ✅ salary payments 3 เดือน')

  // ── 10. historical orders (30 วัน) ────────────────────────────────────────
  console.log('🪑 เพิ่ม historical orders...')
  const mainMenus  = menuData.filter(m => [catMain.id, catRice.id].includes(m.category_id!))
  const sideMenus  = menuData.filter(m => [catSnack.id, catDrink.id, catDessert.id].includes(m.category_id!))

  let totalOrders = 0
  for (let d = 30; d >= 1; d--) {
    const isWeekend = [0, 6].includes(daysAgo(d).getDay())
    const count = isWeekend ? rand(12, 18) : rand(6, 12)
    for (let i = 0; i < count; i++) {
      const hour = rand(10, 21)
      const createdAt = daysAgo(d, hour, rand(0, 59))
      const tbl = pick(allTables)
      const numItems = rand(2, 5)
      const items: any[] = []
      for (let j = 0; j < numItems; j++) {
        const m = j === 0 ? pick(mainMenus) : pick([...mainMenus, ...sideMenus])
        items.push({ menu_id: m.id, menu_name: m.name, quantity: rand(1, 2), unit_price: m.price })
      }
      const subtotal = items.reduce((s, it) => s + it.unit_price * it.quantity, 0)
      const [order] = await db.insert(orders).values({
        restaurant_id: RID, table_id: tbl.id, customer_id: manager.id,
        status: 'served', payment_method: rand(0, 1) ? 'cash' : 'transfer',
        payment_status: 'paid', total: subtotal, discount: 0,
        created_at: createdAt, updated_at: new Date(createdAt.getTime() + rand(30, 90) * 60_000),
      }).returning()
      await db.insert(orderItems).values(items.map(it => ({
        order_id: order.id, menu_id: it.menu_id, menu_name: it.menu_name,
        quantity: it.quantity, unit_price: it.unit_price,
        status: 'served', started_at: createdAt, finished_at: createdAt, served_at: createdAt,
      })))
      totalOrders++
    }
  }
  console.log(`  ✅ ${totalOrders} historical orders`)

  // ── 11. today's orders ─────────────────────────────────────────────────────
  console.log('🔥 เพิ่ม today orders...')
  const [tbl1, tbl2, tbl3, tbl4, tbl5] = allTables

  // served+paid (เช้า)
  const o1 = await db.insert(orders).values({
    restaurant_id: RID, table_id: tbl1.id, customer_id: manager.id,
    status: 'served', payment_method: 'cash', payment_status: 'paid',
    total: 355, discount: 0, created_at: todayAt(10, 15),
  }).returning()
  await db.insert(orderItems).values([
    { order_id: o1[0].id, menu_name: 'ต้มยำกุ้ง',     quantity: 1, unit_price: 180, status: 'served', served_at: todayAt(10, 45) },
    { order_id: o1[0].id, menu_name: 'ข้าวผัดกุ้ง',    quantity: 1, unit_price: 110, status: 'served', served_at: todayAt(10, 40) },
    { order_id: o1[0].id, menu_name: 'ชาเย็น',          quantity: 1, unit_price: 45,  status: 'served', served_at: todayAt(10, 30) },
    { order_id: o1[0].id, menu_name: 'น้ำเปล่า',        quantity: 1, unit_price: 15,  status: 'served', served_at: todayAt(10, 30) },
  ])

  // pending_verification (รอยืนยันสลิป)
  const o2 = await db.insert(orders).values({
    restaurant_id: RID, table_id: tbl2.id, customer_id: manager.id,
    status: 'served', payment_method: 'transfer', payment_status: 'pending_verification',
    slip_path: 'https://placehold.co/400x700/4ade80/ffffff?text=SLIP+฿650',
    total: 650, discount: 0, created_at: todayAt(12, 30),
  }).returning()
  await db.insert(orderItems).values([
    { order_id: o2[0].id, menu_name: 'ปลาราดพริก',     quantity: 1, unit_price: 220, status: 'served', served_at: todayAt(13, 0) },
    { order_id: o2[0].id, menu_name: 'แกงเขียวหวานไก่', quantity: 1, unit_price: 160, status: 'served', served_at: todayAt(13, 5) },
    { order_id: o2[0].id, menu_name: 'ผัดไทยกุ้งสด',   quantity: 1, unit_price: 130, status: 'served', served_at: todayAt(13, 10) },
    { order_id: o2[0].id, menu_name: 'น้ำส้มคั้นสด',    quantity: 2, unit_price: 65,  status: 'served', served_at: todayAt(12, 40) },
    { order_id: o2[0].id, menu_name: 'ข้าวเหนียวมะม่วง', quantity: 1, unit_price: 90, status: 'served', served_at: todayAt(13, 30) },
  ])
  await db.update(tables).set({ status: 'occupied' }).where(eq(tables.id, tbl2.id))

  // cooking (ครัวกำลังทำ)
  const o3 = await db.insert(orders).values({
    restaurant_id: RID, table_id: tbl3.id, customer_id: manager.id,
    status: 'cooking', payment_status: 'unpaid',
    total: 420, discount: 0, created_at: todayAt(13, 45),
  }).returning()
  await db.insert(orderItems).values([
    { order_id: o3[0].id, menu_name: 'ต้มข่าไก่',      quantity: 1, unit_price: 150, status: 'cooking', started_at: todayAt(13, 50) },
    { order_id: o3[0].id, menu_name: 'ผัดกะเพราหมูสับ', quantity: 2, unit_price: 90, status: 'cooking', started_at: todayAt(13, 52) },
    { order_id: o3[0].id, menu_name: 'ยำวุ้นเส้น',      quantity: 1, unit_price: 130, status: 'ready',   finished_at: todayAt(14, 0) },
  ])
  await db.update(tables).set({ status: 'occupied' }).where(eq(tables.id, tbl3.id))

  // pending (เพิ่งสั่ง)
  const o4 = await db.insert(orders).values({
    restaurant_id: RID, table_id: tbl4.id, customer_id: manager.id,
    status: 'pending', payment_status: 'unpaid',
    total: 280, discount: 0, created_at: todayAt(14, 10),
  }).returning()
  await db.insert(orderItems).values([
    { order_id: o4[0].id, menu_name: 'ลาบหมูสด',      quantity: 1, unit_price: 110, status: 'pending' },
    { order_id: o4[0].id, menu_name: 'ทอดมันกุ้ง',     quantity: 1, unit_price: 120, status: 'pending' },
    { order_id: o4[0].id, menu_name: 'โค้ก / เป๊บซี่',  quantity: 2, unit_price: 35,  status: 'pending' },
  ])
  await db.update(tables).set({ status: 'occupied' }).where(eq(tables.id, tbl4.id))

  // unpaid (กินเสร็จ รอจ่าย)
  const o5 = await db.insert(orders).values({
    restaurant_id: RID, table_id: tbl5.id, customer_id: manager.id,
    status: 'served', payment_status: 'unpaid',
    total: 510, discount: 50, created_at: todayAt(11, 0),
  }).returning()
  await db.insert(orderItems).values([
    { order_id: o5[0].id, menu_name: 'ปอเปี๊ยะทอด',    quantity: 2, unit_price: 80,  status: 'served', served_at: todayAt(11, 20) },
    { order_id: o5[0].id, menu_name: 'หมูตุ๋นพะโล้',   quantity: 1, unit_price: 140, status: 'served', served_at: todayAt(11, 25) },
    { order_id: o5[0].id, menu_name: 'ข้าวหน้าเป็ดพะโล้', quantity: 2, unit_price: 110, status: 'served', served_at: todayAt(11, 30) },
    { order_id: o5[0].id, menu_name: 'กาแฟเย็น',        quantity: 2, unit_price: 55,  status: 'served', served_at: todayAt(11, 10) },
  ])
  await db.update(tables).set({ status: 'occupied' }).where(eq(tables.id, tbl5.id))

  console.log('  ✅ 5 today orders (paid / pending_verification / cooking / pending / unpaid)')

  // ── 12. reservations ───────────────────────────────────────────────────────
  console.log('📅 เพิ่ม reservations...')
  const [res1] = await db.insert(reservations).values({
    restaurant_id: RID, table_id: allTables[5].id,
    customer_name: 'คุณสมชาย ใจดี', customer_phone: '0891234567',
    party_size: 4, reserved_at: todayAt(18, 0), notes: 'ขอโต๊ะริมหน้าต่าง',
    status: 'confirmed', pre_order_payment: 'none',
  }).returning()

  // จองพร้อม pre-order รอยืนยัน
  const [res2] = await db.insert(reservations).values({
    restaurant_id: RID, table_id: allTables[6].id,
    customer_name: 'คุณมาลี รักสวย', customer_phone: '0812222333',
    party_size: 6, reserved_at: todayAt(19, 30), notes: 'วันครบรอบแต่งงาน ขอตกแต่งด้วย',
    status: 'confirmed',
    pre_order_items: [
      { menu_id: menuByName['ต้มยำกุ้ง'].id, menu_name: 'ต้มยำกุ้ง',           unit_price: 180, quantity: 2 },
      { menu_id: menuByName['ปลาราดพริก'].id, menu_name: 'ปลาราดพริก',         unit_price: 220, quantity: 1 },
      { menu_id: menuByName['เค้กช็อกโกแลต'].id, menu_name: 'เค้กช็อกโกแลต', unit_price: 120, quantity: 1 },
    ],
    pre_order_total: 700,
    pre_order_payment: 'pending',
    pre_order_slip: 'https://placehold.co/400x700/fb923c/ffffff?text=PRE-ORDER+SLIP+฿700',
  }).returning()

  // จองพรุ่งนี้
  await db.insert(reservations).values([
    {
      restaurant_id: RID, table_id: allTables[7].id,
      customer_name: 'คุณวิชัย ขยันมาก', customer_phone: '0856789012',
      party_size: 2, reserved_at: tomorrowAt(12, 0),
      status: 'confirmed', pre_order_payment: 'none',
    },
    {
      restaurant_id: RID, table_id: allTables[8].id,
      customer_name: 'ครอบครัว จันทร์งาม', customer_phone: '0823456789',
      party_size: 8, reserved_at: tomorrowAt(18, 30), notes: 'มีเด็กเล็ก 2 คน',
      status: 'confirmed', pre_order_payment: 'none',
    },
  ])

  // จองเก่า (seated / cancelled)
  await db.insert(reservations).values([
    {
      restaurant_id: RID, table_id: allTables[0].id,
      customer_name: 'คุณพร ดีใจ', customer_phone: '0834567890',
      party_size: 3, reserved_at: daysAgo(2, 19),
      status: 'seated', pre_order_payment: 'none',
    },
    {
      restaurant_id: RID, table_id: allTables[1].id,
      customer_name: 'คุณนก สวย', customer_phone: '0845678901',
      party_size: 2, reserved_at: daysAgo(3, 20),
      status: 'cancelled', notes: 'ยกเลิกล่วงหน้า', pre_order_payment: 'none',
    },
    {
      restaurant_id: RID, table_id: allTables[2].id,
      customer_name: 'คุณแดง ไวใจ', customer_phone: '0867890123',
      party_size: 5, reserved_at: daysAgo(5, 18, 30),
      status: 'seated',
      pre_order_items: [
        { menu_id: menuByName['แกงเขียวหวานไก่'].id, menu_name: 'แกงเขียวหวานไก่', unit_price: 160, quantity: 2 },
        { menu_id: menuByName['ข้าวผัดกุ้ง'].id,     menu_name: 'ข้าวผัดกุ้ง',      unit_price: 110, quantity: 3 },
      ],
      pre_order_total: 650, pre_order_payment: 'paid',
      pre_order_slip: 'https://placehold.co/400x700/4ade80/ffffff?text=PAID+฿650',
    },
  ])
  console.log('  ✅ 7 reservations')

  // ── 13. loyalty customers & points ────────────────────────────────────────
  console.log('⭐ เพิ่ม customers & loyalty points...')

  async function createCustomer(phone: string, name: string, pts: number) {
    const [c] = await db.insert(customers).values({ restaurant_id: RID, phone, name, total_points: pts }).returning()
    return c
  }

  const cust1 = await createCustomer('0891234567', 'คุณสมชาย ใจดี', 320)
  const cust2 = await createCustomer('0812222333', 'คุณมาลี รักสวย', 850)
  const cust3 = await createCustomer('0812345678', 'คุณทดสอบ มาเนเจอร์', 1200)
  const cust4 = await createCustomer('0856789012', 'คุณวิชัย ขยันมาก', 75)
  const cust5 = await createCustomer('0823456789', 'ครอบครัว จันทร์งาม', 430)
  const cust6 = await createCustomer('0811111111', 'พนักงาน A', 0)

  const txRows: any[] = [
    // cust1 – สมชาย
    { restaurant_id: RID, customer_id: cust1.id, type: 'earn',   points: 18, source: 'order',       note: 'ออเดอร์ ฿180' },
    { restaurant_id: RID, customer_id: cust1.id, type: 'earn',   points: 50, source: 'reservation', note: 'จองโต๊ะสำเร็จ' },
    { restaurant_id: RID, customer_id: cust1.id, type: 'earn',   points: 35, source: 'order',       note: 'ออเดอร์ ฿350' },
    { restaurant_id: RID, customer_id: cust1.id, type: 'redeem', points: -100, source: 'order',     note: 'แลกส่วนลด ฿100' },
    { restaurant_id: RID, customer_id: cust1.id, type: 'earn',   points: 42, source: 'order',       note: 'ออเดอร์ ฿420' },
    { restaurant_id: RID, customer_id: cust1.id, type: 'earn',   points: 275, source: 'order',      note: 'ออเดอร์ ฿2,750' },
    // cust2 – มาลี (VIP)
    { restaurant_id: RID, customer_id: cust2.id, type: 'earn',   points: 250, source: 'order',      note: 'ออเดอร์ ฿2,500' },
    { restaurant_id: RID, customer_id: cust2.id, type: 'earn',   points: 50,  source: 'reservation', note: 'จองโต๊ะสำเร็จ' },
    { restaurant_id: RID, customer_id: cust2.id, type: 'earn',   points: 180, source: 'order',      note: 'ออเดอร์ ฿1,800' },
    { restaurant_id: RID, customer_id: cust2.id, type: 'redeem', points: -200, source: 'order',     note: 'แลกส่วนลด ฿200' },
    { restaurant_id: RID, customer_id: cust2.id, type: 'earn',   points: 570, source: 'order',      note: 'ออเดอร์ ฿5,700' },
    // cust3 – manager
    { restaurant_id: RID, customer_id: cust3.id, type: 'earn',   points: 400, source: 'order',      note: 'ออเดอร์ ฿4,000' },
    { restaurant_id: RID, customer_id: cust3.id, type: 'earn',   points: 50,  source: 'reservation', note: 'จองโต๊ะสำเร็จ' },
    { restaurant_id: RID, customer_id: cust3.id, type: 'earn',   points: 750, source: 'order',      note: 'ออเดอร์ ฿7,500' },
    // cust4 – วิชัย (แต้มน้อย)
    { restaurant_id: RID, customer_id: cust4.id, type: 'earn',   points: 75,  source: 'order',      note: 'ออเดอร์ ฿750' },
    // cust5 – จันทร์งาม
    { restaurant_id: RID, customer_id: cust5.id, type: 'earn',   points: 180, source: 'order',      note: 'ออเดอร์ ฿1,800' },
    { restaurant_id: RID, customer_id: cust5.id, type: 'earn',   points: 50,  source: 'reservation', note: 'จองโต๊ะสำเร็จ' },
    { restaurant_id: RID, customer_id: cust5.id, type: 'earn',   points: 200, source: 'order',      note: 'ออเดอร์ ฿2,000' },
  ]
  for (let i = 0; i < txRows.length; i += 20) {
    await db.insert(pointTransactions).values(txRows.slice(i, i + 20))
  }
  console.log(`  ✅ ${txRows.length} point transactions, 6 customers`)

  // ── done ──────────────────────────────────────────────────────────────────
  console.log('\n✨ Seed เสร็จสมบูรณ์!')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`📊 Historical orders : ${totalOrders} รายการ (30 วัน)`)
  console.log(`🪑 Today orders      : 5 รายการ (paid / pending_verification / cooking / pending / unpaid)`)
  console.log(`📅 Reservations      : 7 รายการ (วันนี้ / พรุ่งนี้ / เก่า)`)
  console.log(`🍽️  Menus             : ${menuData.length} รายการใน 5 หมวด`)
  console.log(`📦 Ingredients       : ${ingData.length} รายการ`)
  console.log(`🎁 Promotions        : 3 รายการ`)
  console.log(`⭐ Customers         : 6 คน (มีแต้ม / ไม่มีแต้ม)`)
  console.log(`💳 Pending slips     : 2 รายการรอยืนยัน (1 order + 1 pre-order)`)
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
