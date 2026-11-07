import { z } from 'zod'
import { networkSchema, type Network } from '@altair/shared/contracts'

const row = z.record(z.string(), z.unknown())
const rowsSchema = z.object({ nodes: z.array(row).max(500), edges: z.array(row).max(2000) })
export function networkFromRows(value: unknown): Network {
  const rows = rowsSchema.parse(value)
  return networkSchema.parse({ version: 1, nodes: rows.nodes.map(n => ({ id: n.id, name: n.name, kind: n.kind, countryCode: n.country_code, coordinates: n.longitude == null || n.latitude == null ? null : [Number(n.longitude), Number(n.latitude)] })), edges: rows.edges.map(e => ({ id: e.id, originId: e.origin_id, destinationId: e.destination_id, mode: e.mode, metadata: e.routing_metadata ?? null })) })
}
