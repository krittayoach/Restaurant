import useSWR from 'swr'
import { api } from '@/lib/api'
import type { MenuItem, Category } from '@/types'

const fetcher = (url: string) => api.get(url)

// ─── Menu Items ───────────────────────────────────────────────────────────────

export function useMenuItems(slug: string) {
  const { data, error, isLoading, mutate } = useSWR<MenuItem[]>(
    slug ? `/menus/${slug}` : null,
    fetcher
  )
  return { items: data ?? [], error, isLoading, mutate }
}

export function useMenuItemsByCategory(slug: string) {
  const { data, error, isLoading, mutate } = useSWR<{ category: Category; items: MenuItem[] }[]>(
    slug ? `/menus/${slug}/by-category` : null,
    fetcher
  )
  return { groups: data ?? [], error, isLoading, mutate }
}

// ─── Categories ───────────────────────────────────────────────────────────────

export function useCategories(slug: string) {
  const { data, error, isLoading, mutate } = useSWR<Category[]>(
    slug ? `/categories/${slug}` : null,
    fetcher
  )
  return { categories: data ?? [], error, isLoading, mutate }
}
