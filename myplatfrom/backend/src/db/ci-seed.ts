/**
 * CI bootstrap seed — creates restaurant + staff + tables from scratch.
 * Run before seed-demo.ts in CI:
 *   bun run src/db/ci-seed.ts && bun run src/db/seed-demo.ts
 */
import { db } from './index'
import { restaurants, users, tables } from './schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'

const SLUG = 'demo-restaurant'
const PW   = await bcrypt.hash('password123', 10)

async function main() {
  console.log('🔧 CI bootstrap seed...\n')

  // 1. Create restaurant (idempotent)
  let [rest] = await db.select().from(restaurants).where(eq(restaurants.slug, SLUG)).limit(1)
  if (!rest) {
    ;[rest] = await db.insert(restaurants).values({
      slug:          SLUG,
      name:          'ลีโอชวนชิม',
      plan:          'pro',
      contact_email: 'manager@demo.com',
    }).returning()
    console.log('✅ Created restaurant:', rest.slug)
  } else {
    console.log('✅ Restaurant already exists:', rest.slug)
  }
  const RID = rest.id

  // 2. Create staff (idempotent — check if manager already exists)
  const existingUsers = await db.select().from(users).where(eq(users.restaurant_id, RID))
  if (!existingUsers.length) {
    await db.insert(users).values([
      { restaurant_id: RID, name: 'ผู้จัดการ',       email: 'manager@demo.com',   email_verified: true, password: PW, role: 'manager',  salary: 35000 },
      { restaurant_id: RID, name: 'สมชาย ใจดี',      email: 'employee1@demo.com', email_verified: true, password: PW, role: 'employee', salary: 18000 },
      { restaurant_id: RID, name: 'สมหญิง ใจงาม',    email: 'employee2@demo.com', email_verified: true, password: PW, role: 'employee', salary: 18000 },
      { restaurant_id: RID, name: 'ครัวชาย',         email: 'chef1@demo.com',     email_verified: true, password: PW, role: 'chef',     salary: 22000 },
      { restaurant_id: RID, name: 'ครัวหญิง',        email: 'chef2@demo.com',     email_verified: true, password: PW, role: 'chef',     salary: 22000 },
    ])
    console.log('✅ Created 5 staff users (manager + 2 employee + 2 chef)')
  } else {
    console.log(`✅ ${existingUsers.length} staff users already exist`)
  }

  // 3. Create tables T1-T10 (idempotent)
  const existingTables = await db.select().from(tables).where(eq(tables.restaurant_id, RID))
  if (!existingTables.length) {
    await db.insert(tables).values(
      Array.from({ length: 10 }, (_, i) => ({
        restaurant_id: RID,
        label:         `T${i + 1}`,
        seats:         4,
        qr_token:      randomBytes(32).toString('hex'),
        qr_generated_at: new Date(),
      }))
    )
    console.log('✅ Created 10 tables (T1–T10) with QR tokens')
  } else {
    console.log(`✅ ${existingTables.length} tables already exist`)
  }

  console.log('\n✅ CI bootstrap complete — run seed-demo.ts next')
  process.exit(0)
}

main().catch(e => { console.error('❌ CI seed failed:', e); process.exit(1) })
