const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

const TOKEN_KEY = 'authToken'
export const saveToken  = (t: string) => { if (typeof window !== 'undefined') localStorage.setItem(TOKEN_KEY, t) }
export const getToken   = (): string  => {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem(TOKEN_KEY) ?? ''
}
export const clearToken = () => { if (typeof window !== 'undefined') localStorage.removeItem(TOKEN_KEY) }

export async function apiFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
    credentials: 'include',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    const msg = err?.error ?? err?.message ?? `Request failed (${res.status})`
    if (res.status === 401 && typeof window !== 'undefined') {
      clearToken()
      window.location.href = '/login'
    }
    if (res.status === 402 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('plan-limit-reached', { detail: err }))
    }
    throw new Error(msg)
  }
  return res.json()
}

export const api = {
  get: (path: string, token?: string) =>
    apiFetch(path, { headers: token ? { Authorization: `Bearer ${token}` } : {} }),
  post: (path: string, body: unknown, token?: string) =>
    apiFetch(path, { method: 'POST', body: JSON.stringify(body), headers: token ? { Authorization: `Bearer ${token}` } : {} }),
  put: (path: string, body: unknown, token?: string) =>
    apiFetch(path, { method: 'PUT', body: JSON.stringify(body), headers: token ? { Authorization: `Bearer ${token}` } : {} }),
  patch: (path: string, body?: unknown, token?: string) =>
    apiFetch(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined, headers: token ? { Authorization: `Bearer ${token}` } : {} }),
  delete: (path: string, token?: string) =>
    apiFetch(path, { method: 'DELETE', headers: token ? { Authorization: `Bearer ${token}` } : {} }),
}
