import { Elysia } from 'elysia'
import { redis } from './redis'

export function getIP(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
}

// Returns true if the caller is rate-limited (increments counter on every call)
export async function checkRateLimit(key: string, max: number, windowSecs: number): Promise<boolean> {
  const count = await redis.incr(key)
  if (count === 1) await redis.expire(key, windowSecs)
  return count > max
}

// Elysia plugin — apply to a route group or the whole app
export function rateLimitPlugin(prefix: string, max: number, windowSecs: number, message = 'Too many requests. Please try again later.') {
  return new Elysia({ name: `ratelimit:${prefix}` }).onBeforeHandle(async ({ request, set }) => {
    const ip = getIP(request)
    const limited = await checkRateLimit(`ratelimit:${prefix}:${ip}`, max, windowSecs)
    if (limited) {
      set.status = 429
      set.headers['Retry-After'] = String(windowSecs)
      return { error: message }
    }
  })
}
