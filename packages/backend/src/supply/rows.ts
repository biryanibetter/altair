import { z } from 'zod'
import { inventoryRecordSchema, movementRecordSchema, orderRecordSchema, replenishmentRecordSchema, supplierCatalogSchema, supplySnapshotSchema, observationSchema } from '@altair/shared/contracts'
import { snapshotFromRows } from '../intelligence/rows'
import { observationFromRow } from '../read'

export const tradeFromRows = (raw: unknown) => z.array(z.record(z.string(), z.unknown())).max(10000).parse(raw).map(r => observationSchema.parse(observationFromRow(r)))

const row = z.record(z.string(), z.unknown())
const time = (v: unknown) => v == null ? null : new Date(String(v)).toISOString()
const amount = (v: unknown) => v == null ? null : String(v)
export function inventoryFromRow(raw: unknown) {
  const r = row.parse(raw)
  return inventoryRecordSchema.parse({ id: r.id, productId: r.product_id, warehouseId: r.warehouse_id, quantity: amount(r.quantity), reservedQuantity: amount(r.reserved_quantity), unit: r.unit, historyStart: time(r.history_start) })
}
export function movementFromRow(raw: unknown) {
  const r = row.parse(raw)
  return movementRecordSchema.parse({ id: r.id, inventoryId: r.inventory_id, kind: r.kind, quantity: amount(r.quantity), unit: r.unit, occurredAt: time(r.occurred_at) })
}
export function orderFromRow(raw: unknown) {
  const r = row.parse(raw)
  return orderRecordSchema.parse({ id: r.id, inventoryId: r.inventory_id, quantity: amount(r.quantity), reservedQuantity: amount(r.reserved_quantity), unit: r.unit, dueAt: time(r.due_at), status: r.status })
}
export function replenishmentFromRow(raw: unknown) {
  const r = row.parse(raw)
  return replenishmentRecordSchema.parse({ shipmentId: r.id, quantity: amount(r.quantity), unit: r.unit, confirmedQuantity: amount(r.confirmed_quantity), verifiedUntil: time(r.verified_until), routeRequest: r.route_request })
}
export function supplyFromRows(raw: unknown) {
  if (Buffer.byteLength(JSON.stringify(raw)) > 4_000_000) throw Error('supply_snapshot_too_large')
  const r = z.object({ baseline: z.unknown(), inventory: row, movements: z.array(row).max(10000), orders: z.array(row).max(1000), replenishments: z.array(row).max(100) }).parse(raw)
  const baseline = snapshotFromRows(r.baseline)
  return { baseline, supply: supplySnapshotSchema.parse({ evaluatedAt: baseline.evaluatedAt, inventory: inventoryFromRow(r.inventory), movements: r.movements.map(movementFromRow), orders: r.orders.map(orderFromRow), replenishments: r.replenishments.map(replenishmentFromRow) }) }
}
export function suppliersFromRows(raw: unknown) {
  if (Buffer.byteLength(JSON.stringify(raw)) > 4_000_000) throw Error('supplier_snapshot_too_large')
  return z.array(row).max(500).parse(raw).map(s => supplierCatalogSchema.parse({ id: s.id, name: s.name, countryCode: s.country_code, locationId: s.location_id, verificationStatus: s.verification_status, verifiedAt: time(s.verified_at), expiresAt: time(s.expires_at), products: z.array(row).max(1000).parse(s.products).map(p => ({ productId: p.product_id, hsCode: p.hs_code, classification: p.classification, evidenceId: p.evidence_id })), capabilities: z.array(row).max(1000).parse(s.capabilities).map(c => ({ name: c.name, evidenceId: c.evidence_id })), evidence: z.array(row).max(1000).parse(s.evidence).map(e => ({ id: e.id, sourceUrl: e.source_url, description: e.description, observedAt: time(e.observed_at), expiresAt: time(e.expires_at), status: e.status })) }))
}
