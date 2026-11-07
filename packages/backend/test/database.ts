import { readFileSync, readdirSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { createIngestionStore, type StoreDatabase } from '@altair/db'

// Actual PostgreSQL engine in WASM. Only Supabase roles/Auth functions are shimmed locally.
export async function testDatabase() {
  const pg = new PGlite()
  await pg.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;`)
  for (const name of readdirSync(new URL('../../db/drizzle/', import.meta.url)).filter(n => /^\d+.*\.sql$/.test(n)).sort()) {
    await pg.exec(readFileSync(new URL(`../../db/drizzle/${name}`, import.meta.url), 'utf8'))
  }
  const db = drizzle(pg)
  const database: StoreDatabase = {
    execute: async q => (await db.execute(q)).rows,
    transaction: work => db.transaction(tx => work(async q => (await tx.execute(q)).rows)),
  }
  return { pg, database, store: createIngestionStore(database) }
}
