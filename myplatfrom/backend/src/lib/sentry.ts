import * as Sentry from '@sentry/node'

let initialized = false

export function initSentry() {
  if (!process.env.SENTRY_DSN) return
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
    environment: process.env.NODE_ENV ?? 'production',
  })
  initialized = true
}

export function captureException(error: unknown, context?: Record<string, unknown>) {
  if (!initialized) return
  Sentry.withScope((scope) => {
    if (context) scope.setExtras(context)
    Sentry.captureException(error)
  })
}
