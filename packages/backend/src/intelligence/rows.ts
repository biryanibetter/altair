import { z } from 'zod'
import { riskSignalIntelligenceSchema, scenarioRecordSchema, scenarioSnapshotSchema, type Network, type ScenarioRecord, type ScenarioSnapshot } from '@altair/shared/contracts'
import { networkFromRows } from '../routing/rows'
import { observationFromRow } from '../read'
import { normalizeRisks } from './risks'

const row = z.record(z.string(), z.unknown())
const riskRowsSchema = z.object({ signals: z.array(row).max(1000), observations: z.array(row).max(5000) })
export function intelligenceFromRows(raw: unknown, time: string) {
  const r = z.object({ network: z.unknown(), riskEvidence: z.unknown() }).parse(raw), network = networkFromRows(r.network)
  return { network, ...risksFromRows(r.riskEvidence, network, time) }
}
export function risksFromRows(raw: unknown, network: Network, time: string) {
  const rows = riskRowsSchema.parse(raw); let legacySignals = 0
  const signals = rows.signals.flatMap(r => {
    if (r.intelligence_metadata === null) { legacySignals++; return [] }
    const signal = riskSignalIntelligenceSchema.parse(r.intelligence_metadata)
    if (signal.id !== r.id || (signal.target.kind === 'node' && signal.target.id !== r.location_id) || (signal.target.kind === 'edge' && signal.target.id !== r.connection_id) || (signal.target.kind === 'supplier' && signal.target.id !== r.supplier_id)) throw Error('risk_target_mismatch')
    return [signal]
  })
  return normalizeRisks({ network, signals, observations: rows.observations.map(observationFromRow), legacySignals }, time)
}
const rawSnapshotSchema = z.object({ version: z.literal(1), evaluatedAt: z.string(), network: z.unknown(), riskEvidence: z.unknown(), inventory: z.array(row).max(1000), shipments: z.array(row).max(1000), supplierIds: z.array(z.uuid()).max(1000), references: z.record(z.string(), z.unknown()) })
export function snapshotFromRows(raw: unknown): ScenarioSnapshot {
  if (Buffer.byteLength(JSON.stringify(raw)) > 2_000_000) throw Error('snapshot_too_large')
  const r = rawSnapshotSchema.parse(raw), network = networkFromRows(r.network), time = new Date(r.evaluatedAt).toISOString()
  const risks = risksFromRows(r.riskEvidence, network, time).signals
  return scenarioSnapshotSchema.parse({ version: 1, evaluatedAt: time, network, risks, inventory: r.inventory.map(i => ({ id: i.id, productId: i.product_id, warehouseId: i.warehouse_id, quantity: i.quantity, unit: i.unit })), shipments: r.shipments.map(s => ({ id: s.id, supplierId: s.supplier_id, productId: s.product_id, estimatedArrival: s.estimated_arrival == null ? null : new Date(String(s.estimated_arrival)).toISOString(), status: s.status, originId: s.origin_id, destinationId: s.destination_id })), supplierIds: r.supplierIds, references: r.references })
}
export function scenarioFromRow(raw: unknown): ScenarioRecord {
  const r = row.parse(raw)
  return scenarioRecordSchema.parse({ id: r.id, name: r.name, createdAt: new Date(String(r.created_at)).toISOString(), engineVersion: r.engine_version, baselineReference: r.baseline_hash, input: r.simulation_input, snapshot: snapshotFromRows(r.baseline_snapshot), output: r.simulation_output })
}
