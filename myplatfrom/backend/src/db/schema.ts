import {
  pgTable, uuid, varchar, boolean, integer, real,
  timestamp, pgEnum, text, jsonb,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ─── Enums ────────────────────────────────────────────────────────────────────
export const roleEnum = pgEnum('role', ['super_admin', 'manager', 'employee', 'chef', 'customer'])
export const tableStatusEnum = pgEnum('table_status', ['available', 'occupied', 'reserved', 'cleaning'])
export const orderStatusEnum = pgEnum('order_status', ['pending', 'cooking', 'ready', 'served', 'cancelled'])
export const orderItemStatusEnum = pgEnum('order_item_status', ['pending', 'cooking', 'ready', 'served', 'cancelled'])
export const paymentMethodEnum = pgEnum('payment_method', ['cash', 'transfer'])
export const paymentStatusEnum = pgEnum('payment_status', ['unpaid', 'pending_verification', 'paid', 'refunded'])
export const planEnum = pgEnum('plan', ['free', 'basic', 'pro'])
export const reservationStatusEnum = pgEnum('reservation_status', ['confirmed', 'seated', 'cancelled', 'no_show'])

// ─── restaurants ──────────────────────────────────────────────────────────────
export const restaurants = pgTable('restaurants', {
  id:         uuid('id').primaryKey().defaultRandom(),
  slug:       varchar('slug', { length: 60 }).notNull().unique(),
  name:       varchar('name', { length: 100 }).notNull(),
  promptpay:  varchar('promptpay', { length: 20 }),
  open_time:  varchar('open_time', { length: 5 }).default('08:00'),
  close_time: varchar('close_time', { length: 5 }).default('22:00'),
  plan:            planEnum('plan').default('free').notNull(),
  plan_expires_at: timestamp('plan_expires_at'),
  is_active:       boolean('is_active').default(true).notNull(),
  suspend_reason:  text('suspend_reason'),
  created_at:      timestamp('created_at').defaultNow().notNull(),
})

// ─── users ────────────────────────────────────────────────────────────────────
export const users = pgTable('users', {
  id:            uuid('id').primaryKey().defaultRandom(),
  restaurant_id: uuid('restaurant_id').references(() => restaurants.id, { onDelete: 'cascade' }),
  name:          varchar('name', { length: 100 }).notNull(),
  phone:         varchar('phone', { length: 20 }).notNull().unique(),
  password:      varchar('password', { length: 255 }),
  role:          roleEnum('role').notNull(),
  salary:        real('salary').default(0),
  is_active:     boolean('is_active').default(true).notNull(),
  created_at:    timestamp('created_at').defaultNow().notNull(),
})

// ─── categories ───────────────────────────────────────────────────────────────
export const categories = pgTable('categories', {
  id:            uuid('id').primaryKey().defaultRandom(),
  restaurant_id: uuid('restaurant_id').notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  name:          varchar('name', { length: 50 }).notNull(),
  sort_order:    integer('sort_order').default(0).notNull(),
  created_at:    timestamp('created_at').defaultNow().notNull(),
})

// ─── menus ────────────────────────────────────────────────────────────────────
export const menus = pgTable('menus', {
  id:            uuid('id').primaryKey().defaultRandom(),
  restaurant_id: uuid('restaurant_id').notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  category_id:   uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
  name:          varchar('name', { length: 100 }).notNull(),
  description:   text('description'),
  price:         real('price').notNull(),
  image:         varchar('image', { length: 255 }),
  is_available:  boolean('is_available').default(true).notNull(),
  is_deleted:    boolean('is_deleted').default(false).notNull(),
  sort_order:    integer('sort_order').default(0).notNull(),
  created_at:    timestamp('created_at').defaultNow().notNull(),
})

// ─── tables ───────────────────────────────────────────────────────────────────
export const tables = pgTable('tables', {
  id:               uuid('id').primaryKey().defaultRandom(),
  restaurant_id:    uuid('restaurant_id').notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  label:            varchar('label', { length: 20 }).notNull(),
  seats:            integer('seats').default(4).notNull(),
  status:           tableStatusEnum('status').default('available').notNull(),
  qr_token:         varchar('qr_token', { length: 64 }).unique(),
  qr_generated_at:  timestamp('qr_generated_at'),
  created_at:       timestamp('created_at').defaultNow().notNull(),
})

// ─── promotions ───────────────────────────────────────────────────────────────
export const promotions = pgTable('promotions', {
  id:            uuid('id').primaryKey().defaultRandom(),
  restaurant_id: uuid('restaurant_id').notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  name:          varchar('name', { length: 100 }).notNull(),
  discount_pct:  real('discount_pct').default(0),
  discount_amt:  real('discount_amt').default(0),
  min_order:     real('min_order').default(0),
  starts_at:     timestamp('starts_at'),
  ends_at:       timestamp('ends_at'),
  is_active:     boolean('is_active').default(true).notNull(),
  created_at:    timestamp('created_at').defaultNow().notNull(),
})

// ─── orders ───────────────────────────────────────────────────────────────────
export const orders = pgTable('orders', {
  id:             uuid('id').primaryKey().defaultRandom(),
  restaurant_id:  uuid('restaurant_id').notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  table_id:       uuid('table_id').notNull().references(() => tables.id),
  customer_id:    uuid('customer_id').references(() => users.id),
  promotion_id:   uuid('promotion_id').references(() => promotions.id),
  status:         orderStatusEnum('status').default('pending').notNull(),
  payment_method: paymentMethodEnum('payment_method'),
  payment_status: paymentStatusEnum('payment_status').default('unpaid').notNull(),
  slip_path:      varchar('slip_path', { length: 255 }),
  total:          real('total').default(0).notNull(),
  discount:       real('discount').default(0).notNull(),
  created_at:     timestamp('created_at').defaultNow().notNull(),
  updated_at:     timestamp('updated_at').defaultNow().notNull(),
})

// ─── order_items ──────────────────────────────────────────────────────────────
export const orderItems = pgTable('order_items', {
  id:          uuid('id').primaryKey().defaultRandom(),
  order_id:    uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  menu_id:     uuid('menu_id').references(() => menus.id),
  menu_name:   varchar('menu_name', { length: 100 }).notNull(),
  quantity:    integer('quantity').notNull(),
  unit_price:  real('unit_price').notNull(),
  note:        text('note'),
  status:      orderItemStatusEnum('status').default('pending').notNull(),
  started_at:  timestamp('started_at'),
  finished_at: timestamp('finished_at'),
  served_at:   timestamp('served_at'),
  created_at:  timestamp('created_at').defaultNow().notNull(),
})

// ─── ingredients ──────────────────────────────────────────────────────────────
export const ingredients = pgTable('ingredients', {
  id:            uuid('id').primaryKey().defaultRandom(),
  restaurant_id: uuid('restaurant_id').notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  name:          varchar('name', { length: 100 }).notNull(),
  unit:          varchar('unit', { length: 20 }).notNull(),
  quantity:      real('quantity').default(0).notNull(),
  low_threshold: real('low_threshold').default(0).notNull(),
  created_at:    timestamp('created_at').defaultNow().notNull(),
})

export const menuIngredients = pgTable('menu_ingredients', {
  id:                uuid('id').primaryKey().defaultRandom(),
  menu_id:           uuid('menu_id').notNull().references(() => menus.id, { onDelete: 'cascade' }),
  ingredient_id:     uuid('ingredient_id').notNull().references(() => ingredients.id, { onDelete: 'cascade' }),
  quantity_per_unit: real('quantity_per_unit').notNull(),
})

// ─── reservations ─────────────────────────────────────────────────────────────
export const reservations = pgTable('reservations', {
  id:             uuid('id').primaryKey().defaultRandom(),
  restaurant_id:  uuid('restaurant_id').notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  table_id:       uuid('table_id').notNull().references(() => tables.id),
  customer_name:  varchar('customer_name', { length: 100 }).notNull(),
  customer_phone: varchar('customer_phone', { length: 20 }).notNull(),
  party_size:     integer('party_size').notNull(),
  reserved_at:    timestamp('reserved_at').notNull(),
  notes:               text('notes'),
  status:              reservationStatusEnum('status').default('confirmed').notNull(),
  pre_order_items:     jsonb('pre_order_items').$type<any[]>(),
  pre_order_total:     real('pre_order_total').default(0).notNull(),
  pre_order_payment:   varchar('pre_order_payment', { length: 20 }).default('none').notNull(),
  pre_order_slip:      text('pre_order_slip'),
  created_at:          timestamp('created_at').defaultNow().notNull(),
})

// ─── customers (loyalty profile, per-tenant) ─────────────────────────────────
export const customers = pgTable('customers', {
  id:            uuid('id').primaryKey().defaultRandom(),
  restaurant_id: uuid('restaurant_id').notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  phone:         varchar('phone', { length: 20 }).notNull(),
  name:          varchar('name', { length: 100 }).notNull(),
  total_points:  integer('total_points').default(0).notNull(),
  created_at:    timestamp('created_at').defaultNow().notNull(),
  updated_at:    timestamp('updated_at').defaultNow().notNull(),
})

// ─── point_transactions ───────────────────────────────────────────────────────
export const pointTransactions = pgTable('point_transactions', {
  id:            uuid('id').primaryKey().defaultRandom(),
  restaurant_id: uuid('restaurant_id').notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  customer_id:   uuid('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
  type:          varchar('type', { length: 10 }).notNull(),    // earn | redeem
  points:        integer('points').notNull(),
  source:        varchar('source', { length: 20 }).notNull(),  // order | reservation | manual
  ref_id:        uuid('ref_id'),
  note:          text('note'),
  created_at:    timestamp('created_at').defaultNow().notNull(),
})

// ─── plan_payments ────────────────────────────────────────────────────────────
export const planPaymentStatusEnum = pgEnum('plan_payment_status', ['pending', 'approved', 'rejected'])

export const planPayments = pgTable('plan_payments', {
  id:            uuid('id').primaryKey().defaultRandom(),
  restaurant_id: uuid('restaurant_id').notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  plan:          planEnum('plan').notNull(),
  amount:        real('amount').notNull(),
  method:        varchar('method', { length: 20 }).notNull(),
  status:        planPaymentStatusEnum('status').default('pending').notNull(),
  slip_url:      varchar('slip_url', { length: 500 }),
  note:          text('note'),
  reviewed_by:   uuid('reviewed_by').references(() => users.id),
  created_at:    timestamp('created_at').defaultNow().notNull(),
  updated_at:    timestamp('updated_at').defaultNow().notNull(),
})

// ─── attendance ───────────────────────────────────────────────────────────────
export const attendance = pgTable('attendance', {
  id:            uuid('id').primaryKey().defaultRandom(),
  user_id:       uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  restaurant_id: uuid('restaurant_id').notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  date:          varchar('date', { length: 10 }).notNull(),
  check_in:      timestamp('check_in').notNull(),
  check_out:     timestamp('check_out'),
  hours_worked:  real('hours_worked'),
})

// ─── salary_payments ──────────────────────────────────────────────────────────
export const salaryPayments = pgTable('salary_payments', {
  id:            uuid('id').primaryKey().defaultRandom(),
  user_id:       uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  restaurant_id: uuid('restaurant_id').notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  amount:        real('amount').notNull(),
  month:         varchar('month', { length: 7 }).notNull(),
  paid_by:       uuid('paid_by').references(() => users.id),
  paid_at:       timestamp('paid_at').defaultNow().notNull(),
})

// ─── audit_logs ───────────────────────────────────────────────────────────────
export const auditLogs = pgTable('audit_logs', {
  id:            uuid('id').primaryKey().defaultRandom(),
  restaurant_id: uuid('restaurant_id').references(() => restaurants.id, { onDelete: 'cascade' }),
  actor_id:      uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
  actor_name:    varchar('actor_name', { length: 100 }),
  actor_role:    varchar('actor_role', { length: 20 }),
  action:        varchar('action', { length: 60 }).notNull(),
  entity_type:   varchar('entity_type', { length: 40 }),
  entity_id:     varchar('entity_id', { length: 100 }),
  meta:          jsonb('meta').$type<Record<string, any>>(),
  ip:            varchar('ip', { length: 60 }),
  created_at:    timestamp('created_at').defaultNow().notNull(),
})

// ─── Relations ────────────────────────────────────────────────────────────────
export const restaurantsRelations = relations(restaurants, ({ many }) => ({
  users:       many(users),
  categories:  many(categories),
  menus:       many(menus),
  tables:      many(tables),
  orders:      many(orders),
  promotions:  many(promotions),
}))

export const ordersRelations = relations(orders, ({ one, many }) => ({
  restaurant: one(restaurants, { fields: [orders.restaurant_id], references: [restaurants.id] }),
  table:      one(tables,      { fields: [orders.table_id],      references: [tables.id] }),
  items:      many(orderItems),
  promotion:  one(promotions,  { fields: [orders.promotion_id],  references: [promotions.id] }),
}))

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.order_id], references: [orders.id] }),
  menu:  one(menus,  { fields: [orderItems.menu_id],  references: [menus.id] }),
}))
