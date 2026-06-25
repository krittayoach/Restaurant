import { Elysia } from 'elysia'
import { db } from '../db'
import { orders, orderItems, menus } from '../db/schema'
import { eq, and, gte, lte, sql } from 'drizzle-orm'
import { t } from 'elysia'
import { requireAuth } from '../lib/requireAuth'

export const reportRoutes = new Elysia({ prefix: '/reports' })

  // GET /reports/sales/weekly
  .get('/sales/weekly', async ({ headers, set }) => {
    const payload = await requireAuth(headers, ['manager'], set)
    if (!payload) return
    const since = new Date(Date.now() - 7 * 86400_000)
    return db.select({
      date: sql<string>`DATE(${orders.created_at})`,
      total: sql<number>`COALESCE(SUM(${orders.total}), 0)`,
      count: sql<number>`COUNT(*)`,
    }).from(orders)
      .where(and(eq(orders.restaurant_id, payload.restaurantId!), eq(orders.payment_status, 'paid'), gte(orders.created_at, since)))
      .groupBy(sql`DATE(${orders.created_at})`)
      .orderBy(sql`DATE(${orders.created_at})`)
  })

  // GET /reports/sales/monthly
  .get('/sales/monthly', async ({ headers, set }) => {
    const payload = await requireAuth(headers, ['manager'], set)
    if (!payload) return
    return db.select({
      month: sql<string>`TO_CHAR(${orders.created_at}, 'YYYY-MM')`,
      total: sql<number>`COALESCE(SUM(${orders.total}), 0)`,
      count: sql<number>`COUNT(*)`,
    }).from(orders)
      .where(and(eq(orders.restaurant_id, payload.restaurantId!), eq(orders.payment_status, 'paid')))
      .groupBy(sql`TO_CHAR(${orders.created_at}, 'YYYY-MM')`)
      .orderBy(sql`TO_CHAR(${orders.created_at}, 'YYYY-MM')`)
  })

  // GET /reports/sales/range?from=YYYY-MM-DD&to=YYYY-MM-DD
  .get('/sales/range', async ({ headers, query, set }) => {
    const payload = await requireAuth(headers, ['manager'], set)
    if (!payload) return
    const from = new Date(query.from)
    const to   = new Date(query.to)
    to.setHours(23, 59, 59, 999)
    const [daily, summary, bestseller] = await Promise.all([
      db.select({
        date:  sql<string>`DATE(${orders.created_at})`,
        total: sql<number>`COALESCE(SUM(${orders.total}), 0)`,
        count: sql<number>`COUNT(*)`,
      }).from(orders)
        .where(and(eq(orders.restaurant_id, payload.restaurantId!), eq(orders.payment_status, 'paid'), gte(orders.created_at, from), lte(orders.created_at, to)))
        .groupBy(sql`DATE(${orders.created_at})`)
        .orderBy(sql`DATE(${orders.created_at})`),
      db.select({
        total:      sql<number>`COALESCE(SUM(${orders.total}), 0)`,
        order_count: sql<number>`COUNT(*)`,
      }).from(orders)
        .where(and(eq(orders.restaurant_id, payload.restaurantId!), eq(orders.payment_status, 'paid'), gte(orders.created_at, from), lte(orders.created_at, to))),
      db.select({
        menu_name: orderItems.menu_name,
        total_qty: sql<number>`SUM(${orderItems.quantity})`,
        revenue:   sql<number>`SUM(${orderItems.quantity} * ${orderItems.unit_price})`,
      }).from(orderItems)
        .innerJoin(orders, eq(orderItems.order_id, orders.id))
        .where(and(eq(orders.restaurant_id, payload.restaurantId!), eq(orders.payment_status, 'paid'), gte(orders.created_at, from), lte(orders.created_at, to)))
        .groupBy(orderItems.menu_name)
        .orderBy(sql`SUM(${orderItems.quantity}) DESC`)
        .limit(10),
    ])
    return { daily, summary: summary[0], bestseller }
  }, {
    query: t.Object({ from: t.String(), to: t.String() }),
  })

  // GET /reports/menu/bestseller
  .get('/menu/bestseller', async ({ headers, set }) => {
    const payload = await requireAuth(headers, ['manager'], set)
    if (!payload) return
    return db.select({
      menu_name: orderItems.menu_name,
      menu_id: orderItems.menu_id,
      total_qty: sql<number>`SUM(${orderItems.quantity})`,
      revenue: sql<number>`SUM(${orderItems.quantity} * ${orderItems.unit_price})`,
    }).from(orderItems)
      .innerJoin(orders, eq(orderItems.order_id, orders.id))
      .where(and(eq(orders.restaurant_id, payload.restaurantId!), eq(orders.payment_status, 'paid')))
      .groupBy(orderItems.menu_name, orderItems.menu_id)
      .orderBy(sql`SUM(${orderItems.quantity}) DESC`)
      .limit(10)
  })
