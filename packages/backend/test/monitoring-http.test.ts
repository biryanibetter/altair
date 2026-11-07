import { expect, it } from 'vitest'
import { createMonitoringHandler, createMonitoringSchedulerHandler, type MonitoringStore } from '../src/monitoring/http'
import { monitoringConfigSchema } from '@altair/shared/contracts'
import { graph, now, id } from './routing-fixtures'

const req = (body?: unknown) => new Request('http://localhost/api/v1/monitoring/evaluate', body === undefined ? undefined : { method: 'POST', body: JSON.stringify(body) })
it('requires verified identity for monitoring APIs and rejects ownership injection', async () => {
  for (const action of ['config', 'configure', 'evaluate', 'alerts', 'transition'] as const) expect((await createMonitoringHandler(action, async () => null)(req({}), id(1))).status).toBe(401)
  const store = {} as MonitoringStore
  expect((await createMonitoringHandler('configure', async () => store)(req({ ownerId: id(1) }))).status).toBe(400)
  expect((await createMonitoringHandler('evaluate', async () => store)(req({ ownerId: id(1) }))).status).toBe(400)
  expect((await createMonitoringHandler('alerts', async () => store)(new Request('http://localhost?limit=2&limit=3'))).status).toBe(400)
})
it('authenticates scheduler calls, accepts empty JSON and rejects caller-selected owners', async () => {
  const secret = 'a'.repeat(32)
  const handler = createMonitoringSchedulerHandler(secret, async () => ({ evaluated: 1, failed: 0, changed: 1 }))
  const call = (body: unknown, auth = `Bearer ${secret}`) => handler(new Request('http://localhost/api/internal/monitoring', { method: 'POST', headers: { Authorization: auth }, body: JSON.stringify(body) }))
  expect((await call({}, 'Bearer wrong')).status).toBe(401)
  expect((await call({})).status).toBe(200)
  expect((await call({ ownerId: id(1) })).status).toBe(400)
})
it('evaluates authorized snapshots and returns sanitized failures and indistinguishable missing alerts', async () => {
  let saved = false
  const store: MonitoringStore = { config: async () => monitoringConfigSchema.parse({}), configure: async config => config, alerts: async () => [], snapshot: async () => ({ revision: id(1), config: monitoringConfigSchema.parse({}), context: { evaluatedAt: now, network: graph(), signals: [], observations: [], shipments: [], inventories: [] } }), reconcile: async (_revision, evaluation) => { saved = evaluation.version === 'monitoring-1.0.0'; return { changed: 0 } }, transition: async () => null }
  const response = await createMonitoringHandler('evaluate', async () => store)(req({}))
  expect(response.status).toBe(200); expect(saved).toBe(true)
  expect(response.headers.get('Cache-Control')).toBe('no-store')
  expect((await createMonitoringHandler('transition', async () => store)(req({ state: 'acknowledged' }), id(1))).status).toBe(404)
  const error = await createMonitoringHandler('evaluate', async () => { throw Error('secret provider credentials') })(req({}))
  expect(error.status).toBe(503); expect(JSON.stringify(await error.json())).not.toContain('secret')
})
