import { describe, expect, it } from 'vitest'
import { getTableConfig } from 'drizzle-orm/pg-core'
import { providerObservations, ingestionState, ingestionRuns } from '../src/schema/ingestion'

describe('ingestion schema', () => {
  it('keeps evidence unique and indexed without altering user tables', () => {
    const table = getTableConfig(providerObservations)
    expect(table.name).toBe('provider_observations')
    expect(table.indexes.some(i => i.config.unique)).toBe(true)
    expect(table.foreignKeys).toHaveLength(1)
    expect(getTableConfig(ingestionState).name).toBe('ingestion_state')
    expect(getTableConfig(ingestionRuns).name).toBe('ingestion_runs')
  })
})
