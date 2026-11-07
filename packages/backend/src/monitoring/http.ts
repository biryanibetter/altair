import { z, ZodError } from 'zod'
import { timingSafeEqual } from 'node:crypto'
import { alertQuerySchema, alertRecordSchema, alertTransitionSchema, monitoringConfigSchema, type MonitoringConfig, type MonitoringEvaluation } from '@altair/shared/contracts'
import { InputError, jsonResponse, readJsonBody } from '../routing/http'
import { evaluateMonitoring } from './evaluate'
import type { monitoringFromRows } from './rows'

export type MonitoringAction = 'config' | 'configure' | 'evaluate' | 'alerts' | 'transition'
export interface MonitoringStore {
  config(): Promise<MonitoringConfig>
  configure(config: MonitoringConfig): Promise<MonitoringConfig>
  snapshot(): Promise<ReturnType<typeof monitoringFromRows>>
  reconcile(revision: string, evaluation: MonitoringEvaluation): Promise<{ changed: number }>
  alerts(query: z.infer<typeof alertQuerySchema>): Promise<unknown[]>
  transition(id: string, state: 'acknowledged' | 'resolved'): Promise<unknown | null>
}
export class MonitoringConflict extends Error {}
export function createMonitoringSchedulerHandler(secret: string | undefined, run: () => Promise<{ evaluated: number; failed: number; changed: number }>) {
  return async (request: Request) => {
    if (!secret || Buffer.byteLength(secret) < 32) return jsonResponse({ error: 'scheduler_unconfigured' }, 503)
    const actual = Buffer.from(request.headers.get('Authorization') ?? ''), expected = Buffer.from(`Bearer ${secret}`)
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return jsonResponse({ error: 'unauthorized' }, 401)
    if (new URL(request.url).searchParams.size) return jsonResponse({ error: 'invalid_request' }, 400)
    try {
      const body = request.body === null ? {} : await readJsonBody(request)
      input(() => z.object({}).strict().parse(body))
      const result = await run(); return jsonResponse(result, result.failed ? 503 : 200)
    }
    catch (error) { return jsonResponse({ error: error instanceof InputError ? 'invalid_request' : 'monitoring_unavailable' }, error instanceof InputError ? 400 : 503) }
  }
}
function input<T>(fn: () => T): T { try { return fn() } catch (e) { if (e instanceof ZodError) throw new InputError('invalid_request'); throw e } }
export function createMonitoringHandler(action: MonitoringAction, authorize: () => Promise<MonitoringStore | null>) {
  return async (request: Request, id?: string) => {
    try {
      const store = await authorize(); if (!store) return jsonResponse({ error: 'unauthorized' }, 401)
      const params = new URL(request.url).searchParams
      if (action === 'alerts') {
        for (const key of params.keys()) if (params.getAll(key).length !== 1) throw new InputError('invalid_query')
        const query = input(() => alertQuerySchema.parse(Object.fromEntries(params)))
        const rows = (await store.alerts(query)).map(a => alertRecordSchema.parse(a)), data = rows.slice(0, query.limit)
        return jsonResponse({ data, nextCursor: rows.length > query.limit ? data.at(-1)!.id : null })
      }
      if (params.size) throw new InputError('invalid_query')
      if (action === 'config') return jsonResponse({ config: monitoringConfigSchema.parse(await store.config()) })
      const body = await readJsonBody(request)
      if (action === 'configure') {
        const config = input(() => monitoringConfigSchema.parse(body))
        return jsonResponse({ config: monitoringConfigSchema.parse(await store.configure(config)) })
      }
      if (action === 'transition') {
        const target = input(() => z.uuid().parse(id)), change = input(() => alertTransitionSchema.parse(body))
        const row = await store.transition(target, change.state)
        return row ? jsonResponse(alertRecordSchema.parse(row)) : jsonResponse({ error: 'not_found' }, 404)
      }
      input(() => z.object({}).strict().parse(body))
      const snapshot = await store.snapshot(), result = evaluateMonitoring(snapshot.context, snapshot.config)
      const persistence = await store.reconcile(snapshot.revision, result)
      return jsonResponse({ ...result, persistence })
    } catch (error) {
      const status = error instanceof InputError ? 400 : error instanceof MonitoringConflict ? 409 : 503
      return jsonResponse({ error: status === 400 ? 'invalid_request' : status === 409 ? 'monitoring_evaluation_conflict' : 'service_unavailable' }, status)
    }
  }
}
