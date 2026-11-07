import { z, ZodError } from 'zod'
import { forecastRequestSchema, inventoryWriteSchema, inventoryPatchSchema, inventoryQuerySchema, inventoryListResponseSchema, inventoryRecordSchema, movementWriteSchema, movementRecordSchema, orderWriteSchema, orderRecordSchema, replenishmentWriteSchema, replenishmentRecordSchema, supplierSearchSchema, supplierCatalogSchema, importDependencyRequestSchema, importDependencyResponseSchema, type Network, type RiskSignal, type Observation, type ScenarioRecord, type ScenarioSnapshot, type SupplySnapshot } from '@altair/shared/contracts'
import { InputError, jsonResponse, readJsonBody } from '../routing/http'
import { hashValue, ScenarioError, TWIN_ENGINE_VERSION } from '../intelligence/scenarios'
import { forecastInventory } from './forecast'
import { matchSuppliers } from './suppliers'
import { importDependency } from './dependency'
import { signalActive } from '../intelligence/risks'

export type SupplyAction = 'list' | 'create' | 'patch' | 'movement' | 'order' | 'updateOrder' | 'replenishment' | 'forecast' | 'suppliers' | 'dependency'
export interface SupplyStore {
  list(query: z.output<typeof inventoryQuerySchema>): Promise<unknown[]>
  write(action: 'create' | 'patch' | 'movement' | 'order' | 'updateOrder' | 'replenishment', input: Record<string, unknown>, id?: string): Promise<unknown | null>
  snapshot(id: string): Promise<{ supply: SupplySnapshot; baseline: ScenarioSnapshot } | null>
  scenario(id: string): Promise<ScenarioRecord | null>
  suppliers(): Promise<unknown[]>
  trade(query: z.output<typeof importDependencyRequestSchema>): Promise<Observation[]>
  intelligence(): Promise<{ network: Network; signals: RiskSignal[] }>
}
function parse<T>(work: () => T): T { try { return work() } catch (e) { if (e instanceof ZodError) throw new InputError('invalid_request'); throw e } }
export function createSupplyHandler(action: SupplyAction, authorize: () => Promise<SupplyStore | null>, clock = () => new Date().toISOString()) {
  return async (request: Request, recordId?: string) => {
    try {
      const store = await authorize(); if (!store) return jsonResponse({ error: 'unauthorized' }, 401)
      const params = new URL(request.url).searchParams
      if (action === 'list') {
        for (const key of params.keys()) if (params.getAll(key).length !== 1) throw new InputError('invalid_query')
        const q = parse(() => inventoryQuerySchema.parse(Object.fromEntries(params)))
        const rows = (await store.list(q)).map(r => inventoryRecordSchema.parse(r)), data = rows.slice(0, q.limit)
        return jsonResponse(inventoryListResponseSchema.parse({ version: 'supply-1.0.0', data, nextCursor: rows.length > q.limit ? data.at(-1)!.id : null }))
      }
      if (params.size) throw new InputError('invalid_query')
      const body = await readJsonBody(request)
      if (action === 'forecast') {
        const q = parse(() => forecastRequestSchema.parse(body)), context = await store.snapshot(q.inventoryId)
        if (!context) return jsonResponse({ error: 'not_found' }, 404)
        const scenario = q.scenarioId ? await store.scenario(q.scenarioId) : null
        if (q.scenarioId && !scenario) return jsonResponse({ error: 'not_found' }, 404)
        if (scenario && scenario.engineVersion !== TWIN_ENGINE_VERSION) return jsonResponse({ error: 'unsupported_engine_version' }, 409)
        // Inventory/shipments/network/evidence must still match the immutable
        // scenario baseline. Time, current orders and consumption history are
        // explicitly a forecasting overlay, not a replay of a prior forecast.
        if (scenario) {
          const compatible = (s: ScenarioSnapshot) => ({ network: s.network, risks: s.risks, inventory: s.inventory, shipments: s.shipments, supplierIds: s.supplierIds })
          if (hashValue(compatible(scenario.snapshot)) !== hashValue(compatible(context.baseline))) return jsonResponse({ error: 'scenario_baseline_changed' }, 409)
        }
        return jsonResponse(forecastInventory(context.supply, q, { baseline: context.baseline, scenario: scenario?.input }))
      }
      if (action === 'suppliers') {
        const q = parse(() => supplierSearchSchema.parse(body))
        return jsonResponse(matchSuppliers(await store.suppliers(), q, clock()))
      }
      if (action === 'dependency') {
        const q = parse(() => importDependencyRequestSchema.parse(body))
        const scenario = q.scenarioId ? await store.scenario(q.scenarioId) : null
        if (q.scenarioId && !scenario) return jsonResponse({ error: 'not_found' }, 404)
        const affected: string[] = []
        const intelligence = await store.intelligence(), time = clock()
        const activeRisks = intelligence.signals.filter(s => signalActive(s, time))
        const needsSuppliers = activeRisks.some(s => s.target.kind === 'supplier') || scenario?.input.modifications.some(m => m.kind === 'supplier_unavailable')
        const catalogs = needsSuppliers ? (await store.suppliers()).map(s => supplierCatalogSchema.parse(s)) : []
        const addTarget = (network: Network, kind: 'node' | 'edge' | 'supplier', id: string) => {
          if (kind === 'supplier') { const country = catalogs.find(c => c.id === id)?.countryCode; if (country) affected.push(country); return }
          const edge = kind === 'edge' ? network.edges.find(e => e.id === id) : null
          for (const node of network.nodes.filter(n => kind === 'node' ? n.id === id : n.id === edge?.originId || n.id === edge?.destinationId)) affected.push(node.countryCode)
        }
        for (const risk of activeRisks) addTarget(intelligence.network, risk.target.kind, risk.target.id)
        if (scenario) {
          const s = scenario.snapshot
          for (const m of scenario.input.modifications) {
            if (m.kind === 'connection') addTarget(s.network, 'edge', m.edgeId)
            if (m.kind === 'supplier_unavailable') addTarget(s.network, 'supplier', m.supplierId)
          }
        }
        const observations = await store.trade(q)
        if (new Set(observations.map(o => o.provider)).size > 1) return jsonResponse({ error: 'select_single_trade_provider' }, 409)
        const result = importDependency(observations.map(o => o.data), q, affected)
        if (observations.some(o => o.expiresAt <= clock())) result.limitations.push('trade_synchronization_stale_historical_periods_unchanged')
        if (scenario) result.limitations.push('scenario_country_codes_match_native_origins_only_no_implicit_country_mapping')
        if (activeRisks.length) result.limitations.push('active_risk_exposure_is_potential_not_confirmed_import_loss')
        return jsonResponse(importDependencyResponseSchema.parse({ ...result, sourceObservations: observations.map(observation => {
          const { data: _data, ...reference } = observation
          void _data
          return reference
        }) }))
      }
      const input = parse(() => (action === 'create' ? inventoryWriteSchema : action === 'patch' ? inventoryPatchSchema : action === 'movement' ? movementWriteSchema : action === 'replenishment' ? replenishmentWriteSchema : orderWriteSchema).parse(body))
      const id = ['patch', 'updateOrder', 'replenishment'].includes(action) ? parse(() => z.uuid().parse(recordId)) : undefined
      const row = await store.write(action, input, id)
      if (!row) return jsonResponse({ error: 'not_found' }, 404)
      const schema = action === 'movement' ? movementRecordSchema : action === 'order' || action === 'updateOrder' ? orderRecordSchema : action === 'replenishment' ? replenishmentRecordSchema : inventoryRecordSchema
      return jsonResponse(schema.parse(row), ['create', 'movement', 'order'].includes(action) ? 201 : 200)
    } catch (error) {
      const invalid = error instanceof InputError || error instanceof ScenarioError
      return jsonResponse({ error: invalid ? 'invalid_request' : 'service_unavailable' }, invalid ? 400 : 503)
    }
  }
}
