import { z } from 'zod'
import { routeRequestSchema, routeComparisonSchema, risksQuerySchema, risksResponseSchema, inventoryQuerySchema, inventoryListResponseSchema, forecastRequestSchema, forecastResponseSchema, supplierSearchSchema, supplierSearchResponseSchema, scenarioInputSchema, scenarioRecordSchema, simulationOutputSchema, importDependencyRequestSchema, importDependencyResponseSchema, shipmentSchema } from '@altair/shared/contracts'
import type { AssistantRequest } from '@altair/shared/contracts'
import { canonical } from '../intelligence/scenarios'
import { bounded } from './bounded'
import { LlmError } from './provider'

const idSchema = z.object({ id: z.uuid() }).strict()
export const assistantShipmentSchema = shipmentSchema.omit({ ownerId: true }).extend({ id: z.uuid(), updatedAt: z.iso.datetime(), verifiedUntil: z.iso.datetime().nullable() }).strict()
const registry = {
  compare_routes: { input: routeRequestSchema, output: routeComparisonSchema, kind: 'estimate', description: 'Compare calculated directed logistics routes. Costs, feasibility and times come only from existing evidence; no freight quotes. Supply catalog origin and destination UUIDs.' },
  disruption_intelligence: { input: risksQuerySchema, output: risksResponseSchema, kind: 'prediction', description: 'Retrieve source-backed disruption signals. Potential intelligence never confirms closures; respect applicability, expiry and nature.' },
  inspect_inventory: { input: inventoryQuerySchema, output: inventoryListResponseSchema, kind: 'fact', description: 'Inspect caller-owned inventory records. Optional productId, warehouseId and cursor, max 100 rows. Owner-maintained records, not live verified stock.' },
  inspect_shipment: { input: idSchema, output: assistantShipmentSchema, kind: 'fact', description: 'Inspect one caller-owned shipment by UUID. No cargo position inferred from broadcasts.' },
  forecast_inventory: { input: forecastRequestSchema, output: forecastResponseSchema, kind: 'estimate', description: 'Calculate stockout/replenishment using existing deterministic forecast. Missing history or lead time remains unknown. Explicit demand/lead-time overrides are user assumptions, never invent them.' },
  search_suppliers: { input: supplierSearchSchema, output: supplierSearchResponseSchema, kind: 'fact', description: 'Search supplier evidence. Potential matches are not verified. Even confirmed catalog matches never prove current availability.' },
  create_simulation: { input: scenarioInputSchema, output: scenarioRecordSchema, kind: 'hypothetical', description: 'Capture a private hypothetical crisis scenario using the existing service; requires explicit request allowSimulationCreation. Does not mutate operations. All assumptions must come from user.' },
  run_simulation: { input: idSchema, output: simulationOutputSchema, kind: 'hypothetical', description: 'Execute an existing caller-owned immutable scenario by UUID, using deterministic engine.' },
  compare_simulation: { input: idSchema, output: simulationOutputSchema, kind: 'hypothetical', description: 'Retrieve verified baseline versus simulated comparison of an executed caller-owned scenario.' },
  import_dependencies: { input: importDependencyRequestSchema, output: importDependencyResponseSchema, kind: 'estimate', description: 'Retrieve deterministic historical trade concentration/dependency analysis. Requires explicit reporter, HS code, edition and currency, not guessed values.' },
} as const
export type AssistantToolName = keyof typeof registry
export type ToolDispatch = (name: AssistantToolName, input: Record<string, unknown>, signal?: AbortSignal) => Promise<Response>
export const toolDefinitions = () => Object.entries(registry).map(([name, spec]) => ({ type: 'function' as const, function: { name, description: spec.description, parameters: z.toJSONSchema(spec.input, { io: 'input', unrepresentable: 'any' }) } }))
export async function executeTool(name: string, input: unknown, dispatch: ToolDispatch, allowCreation: boolean, approvals: AssistantRequest['approvedToolInputs'] = [], signal?: AbortSignal) {
  if (!Object.hasOwn(registry, name)) return { ok: false as const, code: 'unknown_tool' }
  const tool = name as AssistantToolName, spec = registry[tool]
  if (tool === 'create_simulation' && !allowCreation) return { ok: false as const, code: 'simulation_creation_not_authorized' }
  const parsed = spec.input.safeParse(input)
  if (!parsed.success) return { ok: false as const, code: 'invalid_tool_arguments' }
  // Assistant never enables optional paid enrichment through a generated tool call.
  if (tool === 'compare_routes' && (parsed.data as z.output<typeof routeRequestSchema>).preferences.enrichGeometry) return { ok: false as const, code: 'enrichment_not_authorized' }
  const parameters = parsed.data as Record<string, unknown>
  const approved = approvals.some(a => a.tool === tool && (() => { const p = spec.input.safeParse(a.arguments); return p.success && canonical(p.data) === canonical(parsed.data) })())
  const forecastDefaults = tool === 'forecast_inventory' && canonical(parsed.data) === canonical(forecastRequestSchema.parse({ inventoryId: parameters.inventoryId }))
  if (['compare_routes','create_simulation','import_dependencies'].includes(tool) || tool === 'forecast_inventory' && !forecastDefaults) {
    if (!approved) return { ok: false as const, code: 'tool_approval_required', pending: { tool: tool as AssistantRequest['approvedToolInputs'][number]['tool'], arguments: parameters } }
  }
  try {
    const response = await bounded(dispatch(tool, parameters, signal), signal)
    if (!response.ok) { await response.body?.cancel(); return { ok: false as const, code: response.status === 404 ? 'not_found' : response.status === 409 ? 'calculation_conflict' : response.status === 400 ? 'invalid_tool_arguments' : 'tool_unavailable' } }
    // Domain handlers already validate their output; validate again at the model boundary.
    const text = await bounded(response.text(), signal)
    if (Buffer.byteLength(text) > 32768) return { ok: false as const, code: 'tool_result_too_large' }
    const data = spec.output.parse(JSON.parse(text))
    const hypothetical = tool === 'forecast_inventory' && (data as { nature?: string }).nature === 'simulated' || tool === 'compare_routes' && (data as z.output<typeof routeComparisonSchema>).alternatives.some(a => a.hypothetical) || tool === 'disruption_intelligence' && (data as z.output<typeof risksResponseSchema>).data.some(signal => signal.nature === 'simulated')
    return { ok: true as const, kind: hypothetical ? 'hypothetical' as const : spec.kind, data, parameters, parameterAuthority: approved ? 'user_approved' as const : 'record_lookup_or_defaults' as const }
  } catch (e) { if (e instanceof LlmError && e.code === 'request_timeout') throw e; return { ok: false as const, code: 'tool_unavailable' } }
}
