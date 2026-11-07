import { afterEach, describe, expect, it } from 'vitest'
import { getDatabaseUrl } from '../src/env'

const original = process.env.DATABASE_URL
afterEach(() => {
  if (original === undefined) delete process.env.DATABASE_URL
  else process.env.DATABASE_URL = original
})

describe('database configuration', () => {
  it('rejects a missing connection without exposing credentials', () => {
    delete process.env.DATABASE_URL
    expect(() => getDatabaseUrl()).toThrow('DATABASE_URL is not configured')
  })

  it('rejects the placeholder password before trying to connect', () => {
    process.env.DATABASE_URL = 'postgresql://postgres:YOUR-DATABASE-PASSWORD@db.example.com:5432/postgres'
    expect(() => getDatabaseUrl()).toThrow('DATABASE_URL requires a real database password')
  })

  it('accepts a postgres connection and rejects other protocols without leaking their values', () => {
    process.env.DATABASE_URL = 'postgresql://user:secret@localhost:5432/postgres'
    expect(getDatabaseUrl()).toBe(process.env.DATABASE_URL)
    process.env.DATABASE_URL = 'https://user:secret@example.com'
    expect(() => getDatabaseUrl()).toThrow('DATABASE_URL must be a PostgreSQL URL')
  })
})
