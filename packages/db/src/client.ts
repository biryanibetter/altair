import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { sql } from 'drizzle-orm'
import { getDatabaseUrl } from './env'

let db: ReturnType<typeof drizzle> | undefined
let connection: ReturnType<typeof postgres> | undefined

export function getDatabase() {
  if (!db) {
    connection = postgres(getDatabaseUrl(), { prepare: false, max: 1, connect_timeout: 5, connection: { statement_timeout: 5000, lock_timeout: 2000 } })
    db = drizzle({ client: connection })
  }
  return db
}

// For bounded local CLI invocations, not per-request server teardown.
export async function closeDatabase(): Promise<void> {
  const closing = connection
  connection = undefined
  db = undefined
  await closing?.end({ timeout: 5 })
}

export async function checkDatabaseConnection(): Promise<void> {
  await getDatabase().execute(sql`select 1`)
}
