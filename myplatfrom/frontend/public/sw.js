const CACHE = 'kds-shell-v1'

const PRECACHE = [
  '/kds',
  '/icons/kds.svg',
  '/manifest.json',
]

// ─── Install: skip waiting immediately ───────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  )
})

// ─── Activate: clean old caches ──────────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

// ─── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)

  // Only handle same-origin requests
  if (url.origin !== location.origin) return

  // Next.js static chunks: cache-first
  if (url.pathname.startsWith('/_next/static/')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached
        return fetch(e.request).then(res => {
          if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()))
          return res
        })
      })
    )
    return
  }

  // KDS navigation: network-first, fallback to cached shell
  if (e.request.mode === 'navigate' && url.pathname.startsWith('/kds')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()))
          return res
        })
        .catch(() => caches.match(e.request).then(c => c || caches.match('/kds')))
    )
    return
  }

  // Everything else: network-first, stale fallback
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  )
})

// ─── Message: force reload cached page ───────────────────────────────────────
self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

// ─── Push: แจ้งเตือนลูกค้าเมื่ออาหารพร้อม ─────────────────────────────────────
self.addEventListener('push', e => {
  let data = { title: 'แจ้งเตือน', body: '', url: '/', tag: undefined }
  try { if (e.data) data = { ...data, ...e.data.json() } } catch {}

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      icon: '/icons/kds.svg',
      badge: '/icons/kds.svg',
      vibrate: [120, 60, 120],
      renotify: Boolean(data.tag),
      data: { url: data.url || '/' },
    })
  )
})

// ─── Notification click: focus/เปิดแท็บที่เกี่ยวข้อง ──────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close()
  const target = e.notification.data?.url || '/'
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes(target) && 'focus' in c) return c.focus()
      }
      if (self.clients.openWindow) return self.clients.openWindow(target)
    })
  )
})
