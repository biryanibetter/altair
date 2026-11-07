import { createServer } from 'node:http'
import { once } from 'node:events'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { testDatabase } from './database'
import { postgresReader } from './read-database'
import { createJobs } from '../src/providers'
import { ingest } from '../src/ingestion'
import { createReadHandler } from '../src/http'

// Opt-in: REAL provider responses, REAL local PostgreSQL, REAL HTTP read API.
// No remote database writes, external credentials, deployment or synthetic fallback.
describe.skipIf(process.env.ALTAIR_LIVE_PROVIDERS !== '1')('external provider → PostgreSQL → HTTP API', () => {
  let db: Awaited<ReturnType<typeof testDatabase>>
  beforeAll(async () => { db = await testDatabase() }, 30000)
  afterAll(async () => { await db?.pg.close() })
  // Preserve this suite's public-provider scope. Adding a job must not silently
  // authorize licensed traffic/AIS/camera calls or fail on intentionally disabled jobs.
  for (const id of ['qatar-imports', 'qatar-dependencies', 'comtrade', 'weather', 'marine', 'gdelt'] as const) {
    it(`${id}: validates, stores and retrieves a real provider response`, async () => {
      const result = await ingest(createJobs({})[id], db.store)
      console.log(JSON.stringify({ liveProvider: id, ...result }))
      expect(result.status, `${id}: ${result.errorCode ?? result.status}`).toBe('success')
      const resource = ['weather', 'marine'].includes(id) ? 'weather' : id === 'gdelt' ? 'status' : 'trade'
      const handler = createReadHandler(resource, async () => postgresReader(db.database))
      const server = createServer(async (req, res) => {
        try {
          const response = await handler(new Request(`http://localhost${req.url}`))
          res.writeHead(response.status, Object.fromEntries(response.headers))
          res.end(await response.text())
        } catch { res.writeHead(500); res.end() }
      })
      server.listen(0, '127.0.0.1')
      await once(server, 'listening')
      try {
        const address = server.address()
        if (!address || typeof address === 'string') throw new Error('no port')
        const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/${resource}${resource === 'status' ? '' : `?job=${id}`}`)
        expect(response.status).toBe(200)
        const body = await response.json()
        expect(body.data.length).toBeGreaterThan(0)
        if (resource !== 'status') expect(body.data[0].sourceId).toBeTruthy()
        console.log(JSON.stringify({ liveApi: id, status: response.status, storedCount: result.count, returnedCount: body.data.length }))
      } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) }
    }, 40000)
  }
})
