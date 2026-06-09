import { verifyJWT } from './jwt'
import { redis, keys } from './redis'

export async function requireSuperAdmin(token: string): Promise<any> {
  const payload = await verifyJWT(token) // throws if JWT invalid
  if (payload.role !== 'super_admin') throw new Error('Forbidden')
  const session = await redis.get(keys.session(token))
  if (!session) throw new Error('Session expired')
  return payload
}
