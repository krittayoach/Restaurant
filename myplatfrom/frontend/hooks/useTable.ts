import useSWR from 'swr'
import { api } from '@/lib/api'
import type { Table } from '@/types'

const fetcher = (url: string) => api.get(url)

export function useTables(slug: string) {
  const { data, error, isLoading, mutate } = useSWR<Table[]>(
    slug ? `/tables/${slug}` : null,
    fetcher
  )
  return { tables: data ?? [], error, isLoading, mutate }
}
