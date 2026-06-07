import { Elysia, t } from 'elysia'
import { db } from '../db'
import { ingredients, menuIngredients, menus } from '../db/schema'
import { eq, and, lte, sql } from 'drizzle-orm'
import { verifyJWT } from '../lib/jwt'

async function requireManager(headers: any, set: any) {
  const auth = headers['authorization']
  if (!auth?.startsWith('Bearer ')) { set.status = 401; return null }
  try {
    const payload = await verifyJWT(auth.slice(7))
    if (payload.role !== 'manager') { set.status = 403; return null }
    return payload
  } catch { set.status = 401; return null }
}

export const inventoryRoutes = new Elysia({ prefix: '/inventory' })

  // GET /inventory — list all ingredients
  .get('/', async ({ headers, set }) => {
    const payload = await requireManager(headers, set)
    if (!payload) return
    return db.select().from(ingredients)
      .where(eq(ingredients.restaurant_id, payload.restaurantId!))
      .orderBy(ingredients.name)
  })

  // GET /inventory/low-stock — ingredients below threshold
  .get('/low-stock', async ({ headers, set }) => {
    const payload = await requireManager(headers, set)
    if (!payload) return
    return db.select().from(ingredients)
      .where(and(
        eq(ingredients.restaurant_id, payload.restaurantId!),
        lte(ingredients.quantity, ingredients.low_threshold),
      ))
      .orderBy(ingredients.quantity)
  })

  // POST /inventory — create ingredient
  .post('/', async ({ headers, body, set }) => {
    const payload = await requireManager(headers, set)
    if (!payload) return
    const [created] = await db.insert(ingredients).values({
      restaurant_id: payload.restaurantId!,
      name:          body.name,
      unit:          body.unit,
      quantity:      body.quantity ?? 0,
      low_threshold: body.low_threshold ?? 0,
    }).returning()
    set.status = 201
    return created
  }, {
    body: t.Object({
      name:          t.String({ minLength: 1 }),
      unit:          t.String({ minLength: 1 }),
      quantity:      t.Optional(t.Number({ minimum: 0 })),
      low_threshold: t.Optional(t.Number({ minimum: 0 })),
    }),
  })

  // PATCH /inventory/:id — update ingredient
  .patch('/:id', async ({ headers, params, body, set }) => {
    const payload = await requireManager(headers, set)
    if (!payload) return
    const [updated] = await db.update(ingredients)
      .set(body)
      .where(and(eq(ingredients.id, params.id), eq(ingredients.restaurant_id, payload.restaurantId!)))
      .returning()
    if (!updated) { set.status = 404; return { error: 'Not found' } }
    return updated
  }, {
    params: t.Object({ id: t.String() }),
    body: t.Object({
      name:          t.Optional(t.String({ minLength: 1 })),
      unit:          t.Optional(t.String({ minLength: 1 })),
      quantity:      t.Optional(t.Number({ minimum: 0 })),
      low_threshold: t.Optional(t.Number({ minimum: 0 })),
    }),
  })

  // POST /inventory/:id/adjust — manual stock adjustment
  .post('/:id/adjust', async ({ headers, params, body, set }) => {
    const payload = await requireManager(headers, set)
    if (!payload) return
    const [updated] = await db.update(ingredients)
      .set({ quantity: sql`${ingredients.quantity} + ${body.delta}` })
      .where(and(eq(ingredients.id, params.id), eq(ingredients.restaurant_id, payload.restaurantId!)))
      .returning()
    if (!updated) { set.status = 404; return { error: 'Not found' } }
    return updated
  }, {
    params: t.Object({ id: t.String() }),
    body:   t.Object({ delta: t.Number() }),
  })

  // DELETE /inventory/:id
  .delete('/:id', async ({ headers, params, set }) => {
    const payload = await requireManager(headers, set)
    if (!payload) return
    await db.delete(ingredients)
      .where(and(eq(ingredients.id, params.id), eq(ingredients.restaurant_id, payload.restaurantId!)))
    return { ok: true }
  }, { params: t.Object({ id: t.String() }) })

  // GET /inventory/recipe/:menuId — get recipe for a menu item
  .get('/recipe/:menuId', async ({ headers, params, set }) => {
    const payload = await requireManager(headers, set)
    if (!payload) return
    return db.select({
      id:                menuIngredients.id,
      ingredient_id:     menuIngredients.ingredient_id,
      quantity_per_unit: menuIngredients.quantity_per_unit,
      name:              ingredients.name,
      unit:              ingredients.unit,
    }).from(menuIngredients)
      .innerJoin(ingredients, eq(menuIngredients.ingredient_id, ingredients.id))
      .where(eq(menuIngredients.menu_id, params.menuId))
  }, { params: t.Object({ menuId: t.String() }) })

  // PUT /inventory/recipe/:menuId — replace recipe for a menu item
  .put('/recipe/:menuId', async ({ headers, params, body, set }) => {
    const payload = await requireManager(headers, set)
    if (!payload) return
    await db.delete(menuIngredients).where(eq(menuIngredients.menu_id, params.menuId))
    if (body.items.length > 0) {
      await db.insert(menuIngredients).values(
        body.items.map((item: any) => ({
          menu_id:           params.menuId,
          ingredient_id:     item.ingredient_id,
          quantity_per_unit: item.quantity_per_unit,
        }))
      )
    }
    return { ok: true }
  }, {
    params: t.Object({ menuId: t.String() }),
    body:   t.Object({
      items: t.Array(t.Object({
        ingredient_id:     t.String(),
        quantity_per_unit: t.Number({ minimum: 0 }),
      })),
    }),
  })
