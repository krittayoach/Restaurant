import { Elysia, t } from 'elysia'
import { subscriber, keys } from '../lib/redis'
import { requireSuperAdmin } from '../lib/auth'

export const adminRoutes = new Elysia({ prefix: '/admin' })

  // GET /admin/stream  (super_admin only — SSE)
  // EventSource cannot set headers, so token can come from query param or Authorization header
  .get('/stream', async ({ headers, query, set }) => {
    const token = query.token ?? headers.authorization?.replace('Bearer ', '') ?? ''
    try {
      await requireSuperAdmin(token)
    } catch (e: any) {
      set.status = e.message === 'Forbidden' ? 403 : 401
      return { error: e.message }
    }

    set.headers['content-type'] = 'text/event-stream'
    set.headers['cache-control'] = 'no-cache'
    set.headers['connection'] = 'keep-alive'

    const sub = subscriber.duplicate()
    const channel = keys.adminChannel()
    await sub.subscribe(channel)

    return new ReadableStream<Uint8Array>({
      start(controller) {
        sub.on('message', (_, message) => {
          controller.enqueue(new TextEncoder().encode(`data: ${message}\n\n`))
        })
      },
      cancel() { sub.unsubscribe(channel); sub.disconnect() },
    })
  }, {
    query: t.Object({ token: t.Optional(t.String()) }),
  })
