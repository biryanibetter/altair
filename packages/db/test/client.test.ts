import { describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ end: vi.fn(async () => {}), postgres: vi.fn(), drizzle: vi.fn() }))
vi.mock('postgres', () => ({ default: mocks.postgres }))
vi.mock('drizzle-orm/postgres-js', () => ({ drizzle: mocks.drizzle }))
vi.mock('../src/env', () => ({ getDatabaseUrl: () => 'postgres://synthetic-test-only' }))
import { closeDatabase, getDatabase } from '../src/client'

describe('local CLI connection lifecycle', () => {
  it('closes the SQL pool and allows a subsequent fresh connection', async () => {
    mocks.postgres.mockReturnValue({ end: mocks.end })
    mocks.drizzle.mockReturnValue({ test: 'synthetic-db' })
    getDatabase()
    getDatabase()
    expect(mocks.postgres).toHaveBeenCalledTimes(1)
    await closeDatabase()
    expect(mocks.end).toHaveBeenCalledWith({ timeout: 5 })
    getDatabase()
    expect(mocks.postgres).toHaveBeenCalledTimes(2)
    await closeDatabase()
  })
})
