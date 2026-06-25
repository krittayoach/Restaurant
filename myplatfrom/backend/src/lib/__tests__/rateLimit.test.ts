import { describe, test, expect } from 'bun:test'
import { getIP } from '../rateLimit'

describe('getIP', () => {
  test('extracts first IP from x-forwarded-for with multiple IPs', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8, 9.10.11.12' },
    })
    expect(getIP(req)).toBe('1.2.3.4')
  })

  test('returns single IP when only one is present', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '192.168.1.100' },
    })
    expect(getIP(req)).toBe('192.168.1.100')
  })

  test('trims whitespace from IP', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '  10.0.0.1  , 10.0.0.2' },
    })
    expect(getIP(req)).toBe('10.0.0.1')
  })

  test('returns "unknown" when header is absent', () => {
    const req = new Request('http://localhost')
    expect(getIP(req)).toBe('unknown')
  })
})
