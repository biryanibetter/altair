import { beforeEach, describe, expect, it, vi } from 'vitest'

const { checkDatabaseConnection } = vi.hoisted(() => ({ checkDatabaseConnection: vi.fn() }))
vi.mock('@altair/db', () => ({ checkDatabaseConnection }))
import { GET } from './route'

beforeEach(() => checkDatabaseConnection.mockReset())

describe('GET /api/v1/health', () => {
  it('reports connectivity only after a successful database query', async () => {
    checkDatabaseConnection.mockResolvedValueOnce(undefined)
    const response = await GET()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok', database: 'connected' })
    expect(response.headers.get('cache-control')).toContain('no-store')
  })

  it('does not expose connection failure details', async () => {
    checkDatabaseConnection.mockRejectedValueOnce(new Error('private connection detail'))
    const response = await GET()
    expect(response.status).toBe(503)
    expect(await response.text()).not.toContain('private connection detail')
  })
})
