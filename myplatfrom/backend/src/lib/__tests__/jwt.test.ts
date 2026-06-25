import { describe, test, expect, beforeAll } from 'bun:test'
import { signJWT, verifyJWT } from '../jwt'

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-key-for-unit-testing-minimum-32-chars!!'
})

describe('signJWT', () => {
  test('creates a 3-part JWT string', async () => {
    const token = await signJWT({ userId: 'u1', restaurantId: 'r1', role: 'manager' })
    expect(token.split('.')).toHaveLength(3)
  })

  test('handles null restaurantId for super_admin', async () => {
    const token = await signJWT({ userId: 'a1', restaurantId: null, role: 'super_admin' })
    expect(typeof token).toBe('string')
  })
})

describe('verifyJWT', () => {
  test('returns correct payload fields', async () => {
    const token = await signJWT({ userId: 'u1', restaurantId: 'r1', role: 'manager' })
    const payload = await verifyJWT(token)
    expect(payload.userId).toBe('u1')
    expect(payload.restaurantId).toBe('r1')
    expect(payload.role).toBe('manager')
  })

  test('preserves null restaurantId', async () => {
    const token = await signJWT({ userId: 'a1', restaurantId: null, role: 'super_admin' })
    const payload = await verifyJWT(token)
    expect(payload.restaurantId).toBeNull()
    expect(payload.role).toBe('super_admin')
  })

  test('throws on completely invalid token', async () => {
    await expect(verifyJWT('not.a.token')).rejects.toThrow()
  })

  test('throws on empty string', async () => {
    await expect(verifyJWT('')).rejects.toThrow()
  })

  test('throws on tampered payload', async () => {
    const token = await signJWT({ userId: 'u1', restaurantId: 'r1', role: 'manager' })
    const [header, , sig] = token.split('.')
    const fakePayload = Buffer.from(
      JSON.stringify({ userId: 'hacker', restaurantId: 'r2', role: 'super_admin' }),
    ).toString('base64url')
    await expect(verifyJWT(`${header}.${fakePayload}.${sig}`)).rejects.toThrow()
  })

  test('different roles round-trip correctly', async () => {
    for (const role of ['manager', 'employee', 'chef', 'customer']) {
      const token = await signJWT({ userId: 'u1', restaurantId: 'r1', role })
      const payload = await verifyJWT(token)
      expect(payload.role).toBe(role)
    }
  })
})
