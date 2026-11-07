import { z, ZodError } from 'zod'
import { risksQuerySchema, risksResponseSchema, scenarioInputSchema, simulationOutputSchema, type Network, type RiskSignal, type ScenarioInput, type ScenarioRecord, type SimulationOutput } from '@altair/shared/contracts'
import { InputError, jsonResponse, readJsonBody } from '../routing/http'
import { canonical, ScenarioError, simulateScenario, TWIN_ENGINE_VERSION } from './scenarios'
import { signalActive } from './risks'

type Coverage = { unmappedObservations: number; legacySignals: number; rules: string[] }
export interface IntelligenceStore {
  create(input: ScenarioInput, version: string): Promise<ScenarioRecord>
  get(id: string): Promise<ScenarioRecord | null>
  save(id: string, output: SimulationOutput): Promise<ScenarioRecord | null>
  list(limit: number, cursor?: string): Promise<{ id: string; name: string; createdAt: string; engineVersion: string; executed: boolean }[]>
  intelligence(): Promise<{ network: Network; signals: RiskSignal[]; coverage: Coverage }>
}
type Action = 'create' | 'list' | 'read' | 'execute' | 'compare' | 'risks'
const listQuery = z.object({ limit: z.coerce.number().int().min(1).max(100).default(20), cursor: z.uuid().optional() }).strict()
function queryValues(request: Request) {
  const params = new URL(request.url).searchParams
  for (const key of params.keys()) if (params.getAll(key).length > 1) throw new InputError('invalid_query')
  return Object.fromEntries(params)
}
function parseInput<T>(work: () => T): T { try { return work() } catch (e) { if (e instanceof ZodError) throw new InputError('invalid_request'); throw e } }
export function createIntelligenceHandler(action: Action, authorize: () => Promise<IntelligenceStore | null>, clock = () => new Date().toISOString()) {
  return async (request: Request, scenarioId?: string): Promise<Response> => {
    try {
      const store = await authorize(); if (!store) return jsonResponse({ error: 'unauthorized' }, 401)
      if (action === 'risks') {
        const q = parseInput(() => risksQuerySchema.parse(queryValues(request))), time = clock()
        const context = await store.intelligence()
        const all = context.signals.filter(s => (!q.category || s.category === q.category) && (!q.targetId || s.target.id === q.targetId) && (!q.cursor || s.id > q.cursor) && (q.freshness === 'all' || q.freshness === 'active' ? q.freshness === 'all' || signalActive(s, time) : !signalActive(s, time) && s.observedAt <= time))
        const data = all.slice(0, q.limit)
        return jsonResponse(risksResponseSchema.parse({ data, meta: { nextCursor: all.length > q.limit ? data.at(-1)?.id ?? null : null, availability: data.length ? 'available' : 'unavailable', evaluatedAt: time, coverage: context.coverage } }))
      }
      if (action === 'list') {
        const q = parseInput(() => listQuery.parse(queryValues(request)))
        const rows = await store.list(q.limit + 1, q.cursor), data = rows.slice(0, q.limit)
        return jsonResponse({ data, meta: { nextCursor: rows.length > q.limit ? data.at(-1)?.id ?? null : null } })
      }
      if (new URL(request.url).search) throw new InputError('invalid_query')
      if (action === 'create') {
        const body = await readJsonBody(request), input = parseInput(() => scenarioInputSchema.parse(body))
        const record = await store.create(input, TWIN_ENGINE_VERSION)
        simulateScenario(record.snapshot, record.input, record.engineVersion) // validate snapshot-dependent constraints before reporting creation
        return jsonResponse(record, 201)
      }
      const id = parseInput(() => z.uuid().parse(scenarioId))
      const record = await store.get(id); if (!record) return jsonResponse({ error: 'not_found' }, 404)
      if (action === 'read') return jsonResponse(record)
      if (record.engineVersion !== TWIN_ENGINE_VERSION) return jsonResponse({ error: 'unsupported_engine_version' }, 409)
      if (action === 'execute') {
        const body = await readJsonBody(request, 65536, true)
        if (body !== null) throw new InputError('execution_accepts_no_parameters')
      }
      if (action === 'compare' && !record.output) return jsonResponse({ error: 'scenario_not_executed' }, 409)
      const output = simulationOutputSchema.parse(simulateScenario(record.snapshot, record.input, record.engineVersion))
      if (record.output && canonical(output) !== canonical(record.output)) return jsonResponse({ error: 'execution_integrity_conflict' }, 409)
      if (action === 'execute' && !record.output) {
        const saved = await store.save(id, output); if (!saved) return jsonResponse({ error: 'not_found' }, 404)
        if (canonical(saved.output) !== canonical(output)) return jsonResponse({ error: 'execution_integrity_conflict' }, 409)
      }
      return jsonResponse(output)
    } catch (error) {
      const invalid = error instanceof InputError || error instanceof ScenarioError && error.message !== 'unsupported_engine_version'
      return jsonResponse({ error: invalid ? 'invalid_request' : error instanceof ScenarioError ? 'unsupported_engine_version' : 'service_unavailable' }, invalid ? 400 : error instanceof ScenarioError ? 409 : 503)
    }
  }
}
