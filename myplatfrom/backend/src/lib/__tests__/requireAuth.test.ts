import { describe, test, expect, beforeAll } from 'bun:test'
import { signJWT } from '../jwt'
import { requireAuth } from '../requireAuth'

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-key-for-unit-testing-minimum-32-chars!!'
})

function makeSet() {
  return { status: 200 }
}

describe('requireAuth — missing / malformed token', () => {
  test('sets 401 when Authorization header is absent', async () => {
    const set = makeSet()
    const result = await requireAuth({}, ['manager'], set)
    expect(result).toBeNull()
    expect(set.status).toBe(401)
  })

  test('sets 401 when header does not start with Bearer', async () => {
    const set = makeSet()
    const result = await requireAuth({ authorization: 'Basic abc123' }, ['manager'], set)
    expect(result).toBeNull()
    expect(set.status).toBe(401)
  })

  test('sets 401 for completely invalid token', async () => {
    const set = makeSet()
    const result = await requireAuth({ authorization: 'Bearer notavalidtoken' }, ['manager'], set)
    expect(result).toBeNull()
    expect(set.status).toBe(401)
  })

  test('sets 401 for empty Bearer token', async () => {
    const set = makeSet()
    const result = await requireAuth({ authorization: 'Bearer ' }, ['manager'], set)
    expect(result).toBeNull()
    expect(set.status).toBe(401)
  })
})

describe('requireAuth — role guard', () => {
  test('sets 403 when role is not in allowed list', async () => {
    const token = await signJWT({ userId: 'u1', restaurantId: 'r1', role: 'employee' })
    const set = makeSet()
    const result = await requireAuth({ authorization: `Bearer ${token}` }, ['manager'], set)
    expect(result).toBeNull()
    expect(set.status).toBe(403)
  })

  test('sets 403 when chef tries to access manager-only route', async () => {
    const token = await signJWT({ userId: 'u1', restaurantId: 'r1', role: 'chef' })
    const set = makeSet()
    const result = await requireAuth({ authorization: `Bearer ${token}` }, ['manager', 'employee'], set)
    expect(result).toBeNull()
    expect(set.status).toBe(403)
  })
})

describe('requireAuth — valid token', () => {
  test('returns payload when role matches', async () => {
    const token = await signJWT({ userId: 'u1', restaurantId: 'r1', role: 'manager' })
    const set = makeSet()
    const result = await requireAuth({ authorization: `Bearer ${token}` }, ['manager'], set)
    expect(result).not.toBeNull()
    expect(result!.userId).toBe('u1')
    expect(result!.restaurantId).toBe('r1')
    expect(result!.role).toBe('manager')
    expect(set.status).toBe(200)
  })

  test('allows when role is one of multiple allowed roles', async () => {
    const token = await signJWT({ userId: 'u1', restaurantId: 'r1', role: 'employee' })
    const set = makeSet()
    const result = await requireAuth(
      { authorization: `Bearer ${token}` },
      ['manager', 'employee', 'chef'],
      set,
    )
    expect(result).not.toBeNull()
    expect(result!.role).toBe('employee')
  })

  test('returns payload with restaurantId for multi-tenant check', async () => {
    const token = await signJWT({ userId: 'u2', restaurantId: 'rest-xyz', role: 'chef' })
    const set = makeSet()
    const result = await requireAuth({ authorization: `Bearer ${token}` }, ['chef', 'manager'], set)
    expect(result!.restaurantId).toBe('rest-xyz')
  })
})
