import { verifyJWT, JWTPayload } from './jwt'

export async function requireAuth(
  headers: Record<string, string | undefined>,
  roles: string[],
  set: { status?: number | string },
): Promise<JWTPayload | null> {
  const auth = headers['authorization']
  if (!auth?.startsWith('Bearer ')) { set.status = 401; return null }
  try {
    const payload = await verifyJWT(auth.slice(7))
    if (!roles.includes(payload.role)) { set.status = 403; return null }
    return payload
  } catch { set.status = 401; return null }
}
