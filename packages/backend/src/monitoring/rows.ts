import { z } from 'zod'
import { alertRecordSchema, monitoringConfigSchema, observationSchema, routeRequestSchema } from '@altair/shared/contracts'
import { intelligenceFromRows } from '../intelligence/rows'
import { observationFromRow } from '../read'
import { supplyFromRows } from '../supply/rows'
import type { MonitoringContext } from './evaluate'

const row = z.record(z.string(), z.unknown())
const iso = (v: unknown) => v == null ? null : new Date(String(v)).toISOString()
export function alertFromRow(raw: unknown) {
  const r = row.parse(raw)
  return alertRecordSchema.parse({ id: r.id, title: r.title, shipmentId: r.shipment_id, rule: r.rule, dedupKey: r.dedup_key, targetKind: r.target_kind, targetId: r.target_id, severity: r.severity, state: r.state, action: r.action, evidence: r.evidence, occurrence: r.occurrence, notificationCount: r.notification_count, createdAt: iso(r.created_at), updatedAt: iso(r.updated_at), acknowledgedAt: iso(r.acknowledged_at), resolvedAt: iso(r.resolved_at) })
}
export function monitoringFromRows(raw: unknown): { revision: string; config: z.infer<typeof monitoringConfigSchema>; context: MonitoringContext } {
  if (Buffer.byteLength(JSON.stringify(raw)) > 8_000_000) throw Error('monitoring_snapshot_too_large')
  const r = z.object({ config: monitoringConfigSchema, revision: z.uuid(), evaluatedAt: z.string(), intelligence: z.unknown(), shipments: z.array(row).max(100), observations: z.array(row).max(5000), inventories: z.array(z.unknown()).max(10) }).parse(raw)
  const evaluatedAt = new Date(r.evaluatedAt).toISOString(), intelligence = intelligenceFromRows(r.intelligence, evaluatedAt)
  return { revision: r.revision, config: r.config, context: {
    evaluatedAt, network: intelligence.network, signals: intelligence.signals,
    shipments: r.shipments.map(s => ({ id: z.uuid().parse(s.id), status: z.enum(['planned', 'in_transit', 'delivered', 'delayed', 'cancelled']).parse(s.status), updatedAt: z.iso.datetime().parse(iso(s.updated_at)), routeRequest: s.route_request == null ? null : routeRequestSchema.parse(s.route_request) })),
    observations: r.observations.map(o => observationSchema.parse(observationFromRow(o))),
    inventories: r.inventories.map(raw => {
      const s = supplyFromRows(raw)
      s.supply.evaluatedAt = evaluatedAt; s.baseline.evaluatedAt = evaluatedAt
      return s
    }),
  } }
}
