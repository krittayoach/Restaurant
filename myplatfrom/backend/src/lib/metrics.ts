// In-memory metrics — Prometheus text format exposed at GET /metrics
// Resets on process restart; suitable for single-instance deployments

interface Counter { [label: string]: number }
interface DurationBucket { count: number; sum: number }

const requestsTotal: Counter = {}
const requestDuration: { [label: string]: DurationBucket } = {}
const startTime = Date.now()

function labelKey(method: string, path: string, status: number) {
  // Normalize dynamic segments to reduce cardinality
  const normalized = path
    .replace(/\/[0-9a-f-]{36}/gi, '/:id')   // UUIDs
    .replace(/\/[a-f0-9]{64}/gi, '/:token') // hex tokens
    .replace(/\/\d+/g, '/:n')               // numeric ids
  return `${method}|${normalized}|${status}`
}

export function recordRequest(method: string, path: string, status: number, durationMs: number) {
  const key = labelKey(method, path, status)
  requestsTotal[key] = (requestsTotal[key] ?? 0) + 1
  const dKey = `${method}|${path.replace(/\/[0-9a-f-]{36}/gi, '/:id').replace(/\/[a-f0-9]{64}/gi, '/:token').replace(/\/\d+/g, '/:n')}`
  if (!requestDuration[dKey]) requestDuration[dKey] = { count: 0, sum: 0 }
  requestDuration[dKey].count++
  requestDuration[dKey].sum += durationMs
}

export function renderMetrics(): string {
  const lines: string[] = [
    '# HELP process_uptime_seconds Process uptime in seconds',
    '# TYPE process_uptime_seconds gauge',
    `process_uptime_seconds ${((Date.now() - startTime) / 1000).toFixed(1)}`,
    '',
    '# HELP http_requests_total Total HTTP requests',
    '# TYPE http_requests_total counter',
  ]
  for (const [key, count] of Object.entries(requestsTotal)) {
    const [method, path, status] = key.split('|')
    lines.push(`http_requests_total{method="${method}",path="${path}",status="${status}"} ${count}`)
  }
  lines.push('', '# HELP http_request_duration_ms_avg Average request duration in milliseconds', '# TYPE http_request_duration_ms_avg gauge')
  for (const [key, { count, sum }] of Object.entries(requestDuration)) {
    const [method, path] = key.split('|')
    lines.push(`http_request_duration_ms_avg{method="${method}",path="${path}"} ${(sum / count).toFixed(2)}`)
  }
  return lines.join('\n') + '\n'
}
