import Redis from 'ioredis'

export const redis = new Redis(process.env.REDIS_URL!)
export const publisher = new Redis(process.env.REDIS_URL!)
export const subscriber = new Redis(process.env.REDIS_URL!)

// Keys
export const keys = {
  session: (token: string) => `session:${token}`,
  menuCache: (restaurantId: string) => `cache:${restaurantId}:menus`,
  activeOrder: (restaurantId: string, tableId: string) => `${restaurantId}:order:active:${tableId}`,
  kitchenQueue: (restaurantId: string) => `${restaurantId}:queue:kitchen`,
  kitchenChannel: (restaurantId: string) => `${restaurantId}:kitchen`,
  orderChannel: (restaurantId: string) => `${restaurantId}:order:update`,
  tableStatus: (restaurantId: string, tableId: string) => `${restaurantId}:table:${tableId}:status`,
  tableChannel: (restaurantId: string, tableId: string) => `${restaurantId}:table:${tableId}`,
  loginRateLimit: (ip: string) => `ratelimit:login:${ip}`,
  registerRateLimit: (ip: string) => `ratelimit:register:${ip}`,
  customerAuthRateLimit: (ip: string) => `ratelimit:customer-auth:${ip}`,
  paymentRateLimit: (ip: string) => `ratelimit:payment:${ip}`,
  reviewRateLimit: (ip: string) => `ratelimit:review:${ip}`,
  pushRateLimit: (ip: string) => `ratelimit:push:${ip}`,
  pushSubs: (restaurantId: string, tableId: string) => `push:subs:${restaurantId}:${tableId}`,
  adminChannel: () => 'platform:admin',
  superAdminSession: () => 'super_admin:session',
  emailVerifyToken: (token: string) => `email:verify:${token}`,
}

export const SESSION_TTL = 86400        // 24h
export const MENU_CACHE_TTL = 300       // 5 min
export const RATE_LIMIT_TTL = 300       // 5 min
export const RATE_LIMIT_MAX = 5
export const PUSH_SUB_TTL = 21600       // 6h — อายุ subscription ต่อ dining session
