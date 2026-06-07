'use client'

import { useEffect, useRef } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

/**
 * Subscribe to a Server-Sent Events channel.
 * Automatically reconnects on disconnect.
 *
 * @example
 * useSSE(`/kitchen/${slug}/sse`, (event) => {
 *   const data = JSON.parse(event.data)
 *   if (data.type === 'NEW_ORDER') mutate()
 * })
 */
export function useSSE(path: string | null, onMessage: (event: MessageEvent) => void) {
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage

  useEffect(() => {
    if (!path) return

    let es: EventSource
    let reconnectTimer: ReturnType<typeof setTimeout>

    function connect() {
      es = new EventSource(`${API}${path}`, { withCredentials: true })

      es.onmessage = (event) => onMessageRef.current(event)

      es.onerror = () => {
        es.close()
        reconnectTimer = setTimeout(connect, 3_000)
      }
    }

    connect()

    return () => {
      clearTimeout(reconnectTimer)
      es?.close()
    }
  }, [path])
}
