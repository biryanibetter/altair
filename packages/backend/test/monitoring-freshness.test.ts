import { expect, it } from 'vitest'
import { readResource } from '../src/read'

it('reports stale event evidence despite a successful recent polling synchronization', async () => {
  const result = await readResource('freshness', new URLSearchParams(), { observations: async () => [], status: async () => [{ job: 'opensky', status: 'success', lastAttemptAt: new Date().toISOString(), lastSuccessAt: new Date().toISOString(), expiresAt: '2099-01-01T00:00:00.000Z', evidenceFreshUntil: '2020-01-01T00:00:00.000Z', errorCode: null, nextRetryAt: null, cursor: 0, coverage: 'fixture', nature: 'live', recentRuns: [] }] })
  expect(result.data[0]).toMatchObject({ job: 'opensky', status: 'stale' })
})
