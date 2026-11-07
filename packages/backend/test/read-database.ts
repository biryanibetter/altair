import { sql } from 'drizzle-orm'
import { observationFromRow, type Reader } from '../src/read'
import type { StoreDatabase } from '@altair/db'

// Runs API data reads under PostgreSQL's authenticated role, not the owner connection.
export function postgresReader(database: StoreDatabase): Reader {
  return {
    observations: q => database.transaction(async execute => {
      await execute(sql`set local role authenticated`)
      const kinds = sql.join(q.kinds.map(k => sql`${k}`), sql`, `)
      const rows = await execute(sql`select * from public.provider_observations where kind in (${kinds}) ${q.job ? sql`and job=${q.job}` : sql``} ${q.cursor ? sql`and id>${q.cursor}::uuid` : sql``} order by id limit ${q.limit}`)
      return rows.map(observationFromRow)
    }),
    status: () => database.transaction(async execute => {
      await execute(sql`set local role authenticated`)
      return (await execute(sql`select public.ingestion_status() as value`)).map(r => r.value)
    }),
  }
}
