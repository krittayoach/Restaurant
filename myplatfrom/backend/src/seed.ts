import { db } from './db'
import { users, categories, menus, promotions, orders, orderItems, tables, restaurants } from './db/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'

async function seed() {
  console.log('🌱 Seeding database...')

  // ── Auto-detect restaurant ──────────────────────────────────────────────────
  const [restaurant] = await db.select({ id: restaurants.id, slug: restaurants.slug }).from(restaurants).limit(1)
  if (!restaurant) {
    console.error('❌ No restaurant found. Register one first:\n   POST /restaurants/register')
    process.exit(1)
  }
  const RESTAURANT_ID = restaurant.id
  console.log(`🏠 Using restaurant: ${restaurant.slug} (${RESTAURANT_ID})`)

  // ── 1. Extra tables (T6–T10) ────────────────────────────────────────────────
  const existingTables = await db.select().from(tables).where(eq(tables.restaurant_id, RESTAURANT_ID))
  if (existingTables.length < 10) {
    const extra = Array.from({ length: 5 }, (_, i) => ({
      restaurant_id: RESTAURANT_ID,
      label: `T${i + 6}`,
      seats: i < 2 ? 6 : 4,
      qr_token: randomBytes(32).toString('hex'),
      qr_generated_at: new Date(),
    }))
    await db.insert(tables).values(extra)
    console.log('✅ Tables T6–T10 created')
  } else {
    console.log('⏭  Tables already exist')
  }

  // ── 2. Staff accounts ───────────────────────────────────────────────────────
  const staffSeed = [
    { name: 'สมชาย ใจดี',    phone: '0811111111', role: 'employee' as const, salary: 12000 },
    { name: 'สมหญิง รักงาน', phone: '0822222222', role: 'employee' as const, salary: 12000 },
    { name: 'วิชัย ครัวเก่ง', phone: '0833333333', role: 'chef'     as const, salary: 15000 },
    { name: 'มานี ฝีมือดี',   phone: '0844444444', role: 'chef'     as const, salary: 15000 },
  ]
  const pw = await bcrypt.hash('password123', 10)
  for (const s of staffSeed) {
    const existing = await db.select().from(users).where(eq(users.phone, s.phone))
    if (existing.length === 0) {
      await db.insert(users).values({ ...s, restaurant_id: RESTAURANT_ID, password: pw, is_active: true })
      console.log(`✅ Staff: ${s.name} (${s.role})`)
    }
  }

  // ── 3. Categories ───────────────────────────────────────────────────────────
  const categoryData = [
    { name: 'อาหารจานหลัก', sort_order: 1 },
    { name: 'อาหารเรียกน้ำย่อย', sort_order: 2 },
    { name: 'เครื่องดื่ม', sort_order: 3 },
    { name: 'ของหวาน', sort_order: 4 },
  ]
  const existingCats = await db.select().from(categories).where(eq(categories.restaurant_id, RESTAURANT_ID))
  if (existingCats.length > 0) {
    console.log('⏭  Categories already exist')
  } else {
    const insertedCats = await db.insert(categories)
      .values(categoryData.map(c => ({ ...c, restaurant_id: RESTAURANT_ID })))
      .returning()
    console.log('✅ Categories created')

    const catMap = Object.fromEntries(insertedCats.map(c => [c.name, c.id]))

    // ── 4. Menu items ──────────────────────────────────────────────────────────
    const menuData = [
      // อาหารจานหลัก
      { category: 'อาหารจานหลัก', name: 'ข้าวผัดกุ้ง',          price: 80,  sort_order: 1 },
      { category: 'อาหารจานหลัก', name: 'ผัดกระเพราหมูสับไข่ดาว', price: 70,  sort_order: 2 },
      { category: 'อาหารจานหลัก', name: 'ต้มยำกุ้ง',             price: 120, sort_order: 3 },
      { category: 'อาหารจานหลัก', name: 'แกงเขียวหวานไก่',       price: 90,  sort_order: 4 },
      { category: 'อาหารจานหลัก', name: 'ผัดซีอิ๊วหมู',          price: 70,  sort_order: 5 },
      { category: 'อาหารจานหลัก', name: 'ข้าวมันไก่',            price: 60,  sort_order: 6 },
      { category: 'อาหารจานหลัก', name: 'ข้าวหมูแดง',            price: 60,  sort_order: 7 },
      { category: 'อาหารจานหลัก', name: 'ผัดไทยกุ้งสด',          price: 100, sort_order: 8 },
      // อาหารเรียกน้ำย่อย
      { category: 'อาหารเรียกน้ำย่อย', name: 'ปอเปี๊ยะทอด',     price: 60,  sort_order: 1 },
      { category: 'อาหารเรียกน้ำย่อย', name: 'ไก่ทอดกระเทียม',  price: 80,  sort_order: 2 },
      { category: 'อาหารเรียกน้ำย่อย', name: 'ยำวุ้นเส้น',       price: 70,  sort_order: 3 },
      { category: 'อาหารเรียกน้ำย่อย', name: 'ทอดมันปลา',        price: 70,  sort_order: 4 },
      // เครื่องดื่ม
      { category: 'เครื่องดื่ม', name: 'น้ำเปล่า',               price: 15,  sort_order: 1 },
      { category: 'เครื่องดื่ม', name: 'น้ำอัดลม',               price: 25,  sort_order: 2 },
      { category: 'เครื่องดื่ม', name: 'ชาเย็น',                 price: 35,  sort_order: 3 },
      { category: 'เครื่องดื่ม', name: 'กาแฟเย็น',               price: 40,  sort_order: 4 },
      { category: 'เครื่องดื่ม', name: 'น้ำมะนาว',               price: 30,  sort_order: 5 },
      { category: 'เครื่องดื่ม', name: 'น้ำส้มคั้น',             price: 45,  sort_order: 6 },
      // ของหวาน
      { category: 'ของหวาน', name: 'ข้าวเหนียวมะม่วง',           price: 70,  sort_order: 1 },
      { category: 'ของหวาน', name: 'บัวลอย',                     price: 50,  sort_order: 2 },
      { category: 'ของหวาน', name: 'ไอศกรีมกะทิ',                price: 55,  sort_order: 3 },
    ]

    await db.insert(menus).values(
      menuData.map(m => ({
        restaurant_id: RESTAURANT_ID,
        category_id: catMap[m.category],
        name: m.name,
        price: m.price,
        sort_order: m.sort_order,
        is_available: true,
        is_deleted: false,
      }))
    )
    console.log(`✅ ${menuData.length} menu items created`)
  }

  // ── 5. Promotions ───────────────────────────────────────────────────────────
  const existingPromos = await db.select().from(promotions).where(eq(promotions.restaurant_id, RESTAURANT_ID))
  if (existingPromos.length === 0) {
    await db.insert(promotions).values([
      {
        restaurant_id: RESTAURANT_ID,
        name: 'ลด 10% เมื่อสั่งครบ 300',
        discount_pct: 10,
        discount_amt: 0,
        min_order: 300,
        is_active: true,
      },
      {
        restaurant_id: RESTAURANT_ID,
        name: 'ลด 50 บาท เมื่อสั่งครบ 500',
        discount_pct: 0,
        discount_amt: 50,
        min_order: 500,
        is_active: true,
      },
    ])
    console.log('✅ Promotions created')
  } else {
    console.log('⏭  Promotions already exist')
  }

  // ── 6. Sample orders ────────────────────────────────────────────────────────
  const existingOrders = await db.select().from(orders).where(eq(orders.restaurant_id, RESTAURANT_ID))
  if (existingOrders.length === 0) {
    const allTables = await db.select().from(tables).where(eq(tables.restaurant_id, RESTAURANT_ID))
    const allMenus = await db.select().from(menus).where(eq(menus.restaurant_id, RESTAURANT_ID))

    const t1 = allTables.find(t => t.label === 'T1')!
    const t2 = allTables.find(t => t.label === 'T2')!
    const t3 = allTables.find(t => t.label === 'T3')!

    // Order 1: T1 — served (paid)
    const [o1] = await db.insert(orders).values({
      restaurant_id: RESTAURANT_ID,
      table_id: t1.id,
      status: 'served',
      payment_method: 'cash',
      payment_status: 'paid',
      total: 190,
      discount: 0,
    }).returning()
    await db.insert(orderItems).values([
      { order_id: o1.id, menu_name: 'ข้าวผัดกุ้ง',      quantity: 1, unit_price: 80, status: 'served' },
      { order_id: o1.id, menu_name: 'ต้มยำกุ้ง',         quantity: 1, unit_price: 120, status: 'served' },
      { order_id: o1.id, menu_name: 'น้ำเปล่า',           quantity: 1, unit_price: 15, status: 'served' },
    ])

    // Order 2: T2 — cooking (active)
    const [o2] = await db.insert(orders).values({
      restaurant_id: RESTAURANT_ID,
      table_id: t2.id,
      status: 'cooking',
      payment_status: 'unpaid',
      total: 230,
      discount: 0,
    }).returning()
    await db.insert(orderItems).values([
      { order_id: o2.id, menu_name: 'แกงเขียวหวานไก่',   quantity: 1, unit_price: 90,  status: 'cooking' },
      { order_id: o2.id, menu_name: 'ผัดกระเพราหมูสับไข่ดาว', quantity: 1, unit_price: 70, status: 'ready' },
      { order_id: o2.id, menu_name: 'ชาเย็น',             quantity: 2, unit_price: 35,  status: 'served' },
    ])
    await db.update(tables).set({ status: 'occupied' }).where(eq(tables.id, t2.id))

    // Order 3: T3 — pending (just placed)
    const [o3] = await db.insert(orders).values({
      restaurant_id: RESTAURANT_ID,
      table_id: t3.id,
      status: 'pending',
      payment_status: 'unpaid',
      total: 155,
      discount: 0,
    }).returning()
    await db.insert(orderItems).values([
      { order_id: o3.id, menu_name: 'ปอเปี๊ยะทอด',       quantity: 1, unit_price: 60,  status: 'pending' },
      { order_id: o3.id, menu_name: 'ข้าวมันไก่',         quantity: 1, unit_price: 60,  status: 'pending' },
      { order_id: o3.id, menu_name: 'น้ำอัดลม',           quantity: 1, unit_price: 25,  status: 'pending' },
      { order_id: o3.id, menu_name: 'กาแฟเย็น',           quantity: 1, unit_price: 40,  status: 'pending' },
    ])
    await db.update(tables).set({ status: 'occupied' }).where(eq(tables.id, t3.id))

    console.log('✅ 3 sample orders created (served / cooking / pending)')
  } else {
    console.log('⏭  Orders already exist')
  }

  console.log('\n✨ Seed complete!')
  console.log('─────────────────────────────────────────')
  console.log('  Manager  : 0812345678 / password123')
  console.log('  Employee : 0811111111 / password123')
  console.log('  Employee : 0822222222 / password123')
  console.log('  Chef     : 0833333333 / password123')
  console.log('  Chef     : 0844444444 / password123')
  console.log('─────────────────────────────────────────')
  process.exit(0)
}

seed().catch(e => { console.error(e); process.exit(1) })
