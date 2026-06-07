import useSWR from 'swr'
import { api } from '@/lib/api'
import type { Order } from '@/types'

const fetcher = (url: string) => api.get(url)

// ─── Orders (Staff view) ──────────────────────────────────────────────────────

export function useOrders(slug: string, status?: string) {
  const query = status ? `?status=${status}` : ''
  const { data, error, isLoading, mutate } = useSWR<Order[]>(
    slug ? `/orders/${slug}${query}` : null,
    fetcher,
    { refreshInterval: 10_000 }   // poll every 10 s as fallback
  )
  return { orders: data ?? [], error, isLoading, mutate }
}

// ─── Single Order (Customer view) ─────────────────────────────────────────────

export function useOrderByTable(slug: string, qrToken: string) {
  const { data, error, isLoading, mutate } = useSWR<Order | null>(
    slug && qrToken ? `/orders/${slug}/table/${qrToken}/active` : null,
    fetcher,
    { refreshInterval: 5_000 }
  )
  return { order: data ?? null, error, isLoading, mutate }
}

// ─── Kitchen view ─────────────────────────────────────────────────────────────

export function useKitchenOrders(slug: string) {
  const { data, error, isLoading, mutate } = useSWR<Order[]>(
    slug ? `/kitchen/${slug}` : null,
    fetcher,
    { refreshInterval: 8_000 }
  )
  return { orders: data ?? [], error, isLoading, mutate }
}
