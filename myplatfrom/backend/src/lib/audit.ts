import { db } from '../db'
import { auditLogs } from '../db/schema'

export interface AuditOptions {
  restaurantId?: string | null
  actorId?: string | null
  actorName?: string | null
  actorRole?: string | null
  entityType?: string
  entityId?: string
  meta?: Record<string, any>
  ip?: string
}

// Fire-and-forget — never throws, audit failure must not break the main flow
export function logAudit(action: string, opts: AuditOptions = {}): void {
  db.insert(auditLogs).values({
    action,
    restaurant_id: opts.restaurantId ?? null,
    actor_id:      opts.actorId ?? null,
    actor_name:    opts.actorName ?? null,
    actor_role:    opts.actorRole ?? null,
    entity_type:   opts.entityType ?? null,
    entity_id:     opts.entityId ?? null,
    meta:          opts.meta ?? null,
    ip:            opts.ip ?? null,
  }).catch(() => {})
}
