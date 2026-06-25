import { SignJWT, jwtVerify } from 'jose'

export interface JWTPayload {
  userId: string
  restaurantId: string | null
  role: string
}

const secret = new TextEncoder().encode(process.env.JWT_SECRET!)

export async function signJWT(payload: JWTPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(secret)
}

export async function verifyJWT(token: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, secret)
  return payload as unknown as JWTPayload
}
