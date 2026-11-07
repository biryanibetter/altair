import { sql } from 'drizzle-orm'
import { getDatabase, type StoreDatabase } from '@altair/db'
import { evaluateMonitoring } from './evaluate'
import { monitoringFromRows } from './rows'

// Trusted scheduler only: owner IDs come exclusively from persisted settings, never request input.
// Private reads execute as authenticated with that exact owner identity and RLS.
export async function runMonitoring(database?: StoreDatabase) {
  const db: StoreDatabase = database ?? {
    execute: async q => [...await getDatabase().execute(q)],
    transaction: work => getDatabase().transaction(tx => work(async q => [...await tx.execute(q)])),
  }
  const deadline = Date.now() + 25000
  const owners = await db.execute(sql`select owner_id from public.monitoring_settings where last_attempt_at is null or last_attempt_at < clock_timestamp()-interval '5 minutes' order by last_attempt_at nulls first,owner_id limit 5`)
  const result = { evaluated: 0, failed: 0, changed: 0 }
  for (const row of owners) {
    if (Date.now() >= deadline) break
    const owner = String(row.owner_id)
    try {
      const outcome = await db.transaction(async execute => {
        const claimed = await execute(sql`update public.monitoring_settings set last_attempt_at=clock_timestamp(),error_code=null where owner_id=${owner} and (last_attempt_at is null or last_attempt_at < clock_timestamp()-interval '5 minutes') returning owner_id`)
        if (!claimed.length) return null
        await execute(sql`set local role authenticated`)
        await execute(sql`select set_config('request.jwt.claim.sub',${owner},true)`)
        const [raw] = await execute(sql`select public.monitoring_snapshot() as value`)
        const snapshot = monitoringFromRows(raw.value), evaluation = evaluateMonitoring(snapshot.context, snapshot.config)
        const [saved] = await execute(sql`select public.reconcile_monitoring(${snapshot.revision}::uuid,${evaluation.evaluatedAt}::timestamptz,${JSON.stringify(evaluation.candidates)}::jsonb,${JSON.stringify(evaluation.evaluatedKeys)}::jsonb) as value`)
        const value = saved.value as { changed: number }
        return value.changed
      })
      if (outcome !== null) { result.evaluated++; result.changed += outcome }
    } catch {
      // No stack, owner identity, credentials or operational payload in the scheduler response.
      await db.execute(sql`update public.monitoring_settings set last_attempt_at=clock_timestamp(),error_code='evaluation_failed' where owner_id=${owner}`)
      result.failed++
    }
  }
  return result
}
