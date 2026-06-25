import { describe, test, expect } from 'bun:test'
import { POINTS_PER_BAHT, POINTS_PER_RESERVATION, MIN_REDEEM_POINTS, BAHT_PER_POINT } from '../loyalty'

describe('loyalty constants', () => {
  test('POINTS_PER_BAHT is 0.1 (1 point per ฿10)', () => {
    expect(POINTS_PER_BAHT).toBe(0.1)
  })

  test('POINTS_PER_RESERVATION is 50', () => {
    expect(POINTS_PER_RESERVATION).toBe(50)
  })

  test('MIN_REDEEM_POINTS is 100', () => {
    expect(MIN_REDEEM_POINTS).toBe(100)
  })

  test('BAHT_PER_POINT is 1 (1 point = ฿1 discount)', () => {
    expect(BAHT_PER_POINT).toBe(1)
  })
})

describe('point calculation logic', () => {
  const calcPoints = (orderTotal: number) => Math.floor(orderTotal * POINTS_PER_BAHT)

  test('฿10 order earns 1 point', () => {
    expect(calcPoints(10)).toBe(1)
  })

  test('฿100 order earns 10 points', () => {
    expect(calcPoints(100)).toBe(10)
  })

  test('฿250 order earns 25 points', () => {
    expect(calcPoints(250)).toBe(25)
  })

  test('฿9 order earns 0 points (floor)', () => {
    expect(calcPoints(9)).toBe(0)
  })

  test('฿999 order earns 99 points', () => {
    expect(calcPoints(999)).toBe(99)
  })
})

describe('redeem threshold', () => {
  test('99 points cannot be redeemed (below MIN_REDEEM_POINTS)', () => {
    expect(99 >= MIN_REDEEM_POINTS).toBe(false)
  })

  test('100 points can be redeemed (exactly at MIN_REDEEM_POINTS)', () => {
    expect(100 >= MIN_REDEEM_POINTS).toBe(true)
  })

  test('200 points can be redeemed', () => {
    expect(200 >= MIN_REDEEM_POINTS).toBe(true)
  })

  test('100 points redeemed = ฿100 discount', () => {
    expect(100 * BAHT_PER_POINT).toBe(100)
  })
})
