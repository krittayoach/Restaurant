import { describe, test, expect, beforeAll } from 'bun:test'
import { getPublicUrl, menuImageKey, slipKey } from '../storage'

beforeAll(() => {
  process.env.OBJECT_STORAGE_PUBLIC_URL = 'http://localhost:9000/bucket'
  process.env.OBJECT_STORAGE_BUCKET = 'restaurant-bucket'
  process.env.OBJECT_STORAGE_ACCESS_KEY = 'minioadmin'
  process.env.OBJECT_STORAGE_SECRET_KEY = 'minioadmin'
  process.env.OBJECT_STORAGE_ENDPOINT = 'http://localhost:9000'
})

describe('getPublicUrl', () => {
  test('combines base URL and key', () => {
    const url = getPublicUrl('menus/r1/image.jpg')
    expect(url).toBe('http://localhost:9000/bucket/menus/r1/image.jpg')
  })

  test('handles nested key path', () => {
    const url = getPublicUrl('slips/r1/order-1_slip.png')
    expect(url).toBe('http://localhost:9000/bucket/slips/r1/order-1_slip.png')
  })
})

describe('menuImageKey', () => {
  test('starts with menus/{restaurantId}/', () => {
    const key = menuImageKey('rest-abc', 'photo.jpg')
    expect(key).toMatch(/^menus\/rest-abc\//)
  })

  test('ends with the original filename', () => {
    const key = menuImageKey('rest-abc', 'photo.jpg')
    expect(key).toMatch(/photo\.jpg$/)
  })

  test('includes a timestamp between prefix and filename', () => {
    const key = menuImageKey('rest-abc', 'photo.jpg')
    const match = key.match(/^menus\/rest-abc\/(\d+)_photo\.jpg$/)
    expect(match).not.toBeNull()
    expect(Number(match![1])).toBeGreaterThan(0)
  })
})

describe('slipKey', () => {
  test('returns correct namespaced path', () => {
    expect(slipKey('r1', 'order-1', 'slip.png')).toBe('slips/r1/order-1_slip.png')
  })

  test('handles different extensions', () => {
    expect(slipKey('r1', 'o2', 'receipt.jpeg')).toBe('slips/r1/o2_receipt.jpeg')
  })
})
