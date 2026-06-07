// ─── Enums ────────────────────────────────────────────────────────────────────

export type Role = 'super_admin' | 'manager' | 'employee' | 'chef' | 'customer'

export type TableStatus = 'available' | 'occupied' | 'reserved' | 'cleaning'

export type OrderStatus = 'pending' | 'cooking' | 'ready' | 'served' | 'cancelled'

export type OrderItemStatus = 'pending' | 'cooking' | 'ready' | 'served' | 'cancelled'

export type PaymentMethod = 'cash' | 'transfer'

export type PaymentStatus = 'unpaid' | 'pending_verification' | 'paid' | 'refunded'

export type Plan = 'free' | 'basic' | 'pro'

// ─── Core Models ──────────────────────────────────────────────────────────────

export interface Restaurant {
  id: string
  slug: string
  name: string
  promptpay?: string
  open_time: string
  close_time: string
  plan: Plan
  is_active: boolean
  created_at: string
}

export interface User {
  id: string
  restaurant_id: string
  name: string
  phone: string
  role: Role
  salary?: number
  is_active: boolean
  created_at: string
}

export interface Category {
  id: string
  restaurant_id: string
  name: string
  sort_order: number
  created_at: string
}

export interface MenuItem {
  id: string
  restaurant_id: string
  category_id?: string
  category?: Category
  name: string
  description?: string
  price: number
  image?: string
  is_available: boolean
  is_deleted: boolean
  sort_order: number
  created_at: string
}

export interface Table {
  id: string
  restaurant_id: string
  label: string
  seats: number
  status: TableStatus
  qr_token?: string
  qr_generated_at?: string
  created_at: string
}

export interface Promotion {
  id: string
  restaurant_id: string
  name: string
  discount_pct?: number
  discount_amt?: number
  min_order?: number
  starts_at?: string
  ends_at?: string
  is_active: boolean
  created_at: string
}

// ─── Order ────────────────────────────────────────────────────────────────────

export interface OrderItem {
  id: string
  order_id: string
  menu_id?: string
  menu_name: string
  quantity: number
  unit_price: number
  note?: string
  status: OrderItemStatus
  started_at?: string
  finished_at?: string
  served_at?: string
  created_at: string
}

export interface Order {
  id: string
  restaurant_id: string
  table_id: string
  table?: Table
  customer_id?: string
  promotion_id?: string
  promotion?: Promotion
  status: OrderStatus
  payment_method?: PaymentMethod
  payment_status: PaymentStatus
  slip_path?: string
  total: number
  discount: number
  items: OrderItem[]
  created_at: string
  updated_at: string
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface JwtPayload {
  sub: string          // user id
  role: Role
  restaurantId: string
  restaurantSlug: string
  name: string
  iat: number
  exp: number
}

export interface AuthResponse {
  token: string
  user: User
}

// ─── API Responses ────────────────────────────────────────────────────────────

export interface ApiError {
  error: string
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
}

// ─── Dashboard / Reports ──────────────────────────────────────────────────────

export interface DailySummary {
  date: string
  total_revenue: number
  total_orders: number
  avg_order_value: number
}

export interface ReportSummary {
  total_revenue: number
  total_orders: number
  top_items: { name: string; quantity: number; revenue: number }[]
  daily: DailySummary[]
}

// ─── SSE Events ───────────────────────────────────────────────────────────────

export type KitchenEvent =
  | { type: 'NEW_ORDER';      order: Order }
  | { type: 'ITEM_STATUS';    itemId: string; status: OrderItemStatus }
  | { type: 'ORDER_ACCEPTED'; orderId: string }

export type OrderUpdateEvent =
  | { type: 'ITEM_READY';   itemId: string; orderId: string }
  | { type: 'ITEM_SERVED';  itemId: string; orderId: string }
  | { type: 'ORDER_SERVED'; orderId: string }
