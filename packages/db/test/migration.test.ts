import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(new URL('../drizzle/0000_nappy_exiles.sql', import.meta.url), 'utf8')

describe('initial migration security', () => {
  it('enables RLS and limits public catalog to signed-in readers', () => {
    expect(migration).toMatch(/ENABLE ROW LEVEL SECURITY/i)
    expect(migration).toMatch(/FOR SELECT TO authenticated/i)
    expect(migration).toMatch(/REVOKE ALL.*anon/i)
  })

  it('restricts private writes and reads to auth.uid()', () => {
    expect(migration).toMatch(/FOR INSERT TO authenticated/i)
    expect(migration).toMatch(/FOR UPDATE TO authenticated/i)
    expect(migration).toMatch(/FOR DELETE TO authenticated/i)
    expect(migration).toMatch(/auth\.uid\(\)/i)
  })

  it('refreshes updated_at when records change', () => {
    expect(migration).toMatch(/CREATE TRIGGER.*BEFORE UPDATE/is)
    expect(migration).toMatch(/NEW\.updated_at = now\(\)/i)
  })
})
