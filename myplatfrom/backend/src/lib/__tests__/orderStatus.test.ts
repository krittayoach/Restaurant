import { describe, test, expect } from 'bun:test'
import { deriveOrderStatus } from '../orderStatus'

describe('deriveOrderStatus — kitchen state machine', () => {
  test('all pending → pending', () => {
    expect(deriveOrderStatus(['pending', 'pending', 'pending'])).toBe('pending')
  })

  test('any item cooking → cooking', () => {
    expect(deriveOrderStatus(['cooking', 'pending'])).toBe('cooking')
  })

  test('all cooking → cooking', () => {
    expect(deriveOrderStatus(['cooking', 'cooking'])).toBe('cooking')
  })

  test('cooking takes priority over ready', () => {
    expect(deriveOrderStatus(['cooking', 'ready', 'pending'])).toBe('cooking')
  })

  test('all ready → ready', () => {
    expect(deriveOrderStatus(['ready', 'ready', 'ready'])).toBe('ready')
  })

  test('mix of ready and served → ready', () => {
    expect(deriveOrderStatus(['ready', 'served', 'ready'])).toBe('ready')
  })

  test('all served → ready (served transition handled by serving route)', () => {
    // kitchen.ts sets 'ready' when all items are ready/served
    // the 'served' order status is set separately in serving.ts
    expect(deriveOrderStatus(['served', 'served'])).toBe('ready')
  })

  test('single pending item → pending', () => {
    expect(deriveOrderStatus(['pending'])).toBe('pending')
  })

  test('single cooking item → cooking', () => {
    expect(deriveOrderStatus(['cooking'])).toBe('cooking')
  })

  test('single ready item → ready', () => {
    expect(deriveOrderStatus(['ready'])).toBe('ready')
  })

  test('cancelled item prevents ready (kitchen does not filter cancelled)', () => {
    // kitchen.ts does not filter cancelled items — 'cancelled' is not 'ready'|'served'
    // so ['ready', 'cancelled'] stays 'pending'. serving.ts handles this differently.
    expect(deriveOrderStatus(['ready', 'cancelled'])).toBe('pending')
  })

  test('cancelled + pending → pending', () => {
    expect(deriveOrderStatus(['pending', 'cancelled'])).toBe('pending')
  })
})
