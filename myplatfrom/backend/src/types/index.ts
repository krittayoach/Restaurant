// ─── Role ─────────────────────────────────────────────────────────────────────

export type Role = 'super_admin' | 'manager' | 'employee' | 'chef' | 'customer'

export const ROLES = {
  SUPER_ADMIN: 'super_admin' as const,
  MANAGER:     'manager'     as const,
  EMPLOYEE:    'employee'    as const,
  CHEF:        'chef'        as const,
  CUSTOMER:    'customer'    as const,
}

/** Roles that can access staff dashboard */
export const STAFF_ROLES: Role[] = ['super_admin', 'manager', 'employee', 'chef']

// ─── JWT ──────────────────────────────────────────────────────────────────────

export interface JwtPayload {
  sub: string           // user id
  role: Role
  restaurantId: string
  restaurantSlug: string
  name: string
}

// ─── SSE Events ───────────────────────────────────────────────────────────────

/** Events published to `{restaurantId}:kitchen` */
export type KitchenSSEEvent =
  | { type: 'NEW_ORDER';      orderId: string; tableLabel: string; itemCount: number }
  | { type: 'ITEM_STATUS';    itemId: string; orderId: string; status: string }
  | { type: 'ORDER_ACCEPTED'; orderId: string }

/** Events published to `{restaurantId}:order:update` */
export type OrderSSEEvent =
  | { type: 'ITEM_READY';   itemId: string; orderId: string; menuName: string }
  | { type: 'ITEM_SERVED';  itemId: string; orderId: string }
  | { type: 'ORDER_SERVED'; orderId: string }

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginationQuery {
  page?: number
  limit?: number
}

// ─── Generic Response Helpers ─────────────────────────────────────────────────

export function ok<T>(data: T) {
  return { success: true as const, data }
}

export function err(message: string, status = 400) {
  return { success: false as const, error: message, status }
}
