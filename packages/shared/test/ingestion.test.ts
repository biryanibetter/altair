import { describe, expect, it } from 'vitest'
import { observationSchema, readQuerySchema, freshnessFor } from '../src/contracts/ingestion'

describe('ingestion contracts', () => {
  it('does not accept unavailable or fabricated numeric observations', () => {
    expect(observationSchema.safeParse({ nature: 'unavailable', data: { value: 0 } }).success).toBe(false)
  })
  it('bounds reads and rejects invalid cursors', () => {
    expect(readQuerySchema.parse({}).limit).toBe(50)
    expect(readQuerySchema.safeParse({ limit: 101 }).success).toBe(false)
    expect(readQuerySchema.safeParse({ cursor: 'not-a-uuid' }).success).toBe(false)
  })
  it('distinguishes missing, stale and fresh synchronization', () => {
    const now = new Date('2026-11-06T12:00:00Z')
    expect(freshnessFor(null, now)).toBe('unavailable')
    expect(freshnessFor('2026-11-06T11:59:00Z', now)).toBe('stale')
    expect(freshnessFor('2026-11-06T13:00:00Z', now)).toBe('fresh')
  })
})
