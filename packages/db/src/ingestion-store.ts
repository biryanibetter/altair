import { randomUUID } from 'node:crypto'
import { sql, type SQL } from 'drizzle-orm'
import { observationSchema, providerStatusSchema, type JobId, type Observation } from '@altair/shared/contracts'
import { getDatabase } from './client'

export type Execute = (query: SQL) => Promise<Record<string, unknown>[]>
export interface StoreDatabase { execute: Execute; transaction: <T>(work: (execute: Execute) => Promise<T>) => Promise<T> }
export interface IngestionBatch { observations: Observation[]; nextCursor: number; coverage: string }
export type Claim = { status: 'claimed'; runId: string; cursor: number } | { status: 'busy' | 'cached' | 'deferred' }
export type IngestionStore = ReturnType<typeof createIngestionStore>
const time = (value: unknown) => value === null || value === undefined ? 0 : new Date(String(value)).getTime()

export function createIngestionStore(database?: StoreDatabase) {
  const db = (): StoreDatabase => database ?? {
    execute: async q => [...await getDatabase().execute(q)],
    transaction: work => getDatabase().transaction(tx => work(async q => [...await tx.execute(q)])),
  }
  return {
    async claim(job: JobId, scope = 'default'): Promise<Claim> {
      return db().transaction(async execute => {
        await execute(sql`insert into public.ingestion_state(job) values (${job}) on conflict do nothing`)
        const [row] = await execute(sql`select *, clock_timestamp() as server_now from public.ingestion_state where job=${job} for update`)
        const now = time(row.server_now)
        if (time(row.lease_until) > now) return { status: 'busy' }
        const sameScope = row.scope === scope
        if (sameScope && time(row.next_retry_at) > now) return { status: 'deferred' }
        if (sameScope && time(row.expires_at) > now && row.status === 'success') return { status: 'cached' }
        if (row.lease_token) await execute(sql`update public.ingestion_runs set status='interrupted', error_code='lease_expired', finished_at=clock_timestamp() where id=${row.lease_token} and status='running'`)
        const runId = randomUUID()
        await execute(sql`update public.ingestion_state set scope=${scope}, cursor=${sameScope ? Number(row.cursor) : 0}, lease_token=${runId}, lease_until=clock_timestamp()+interval '90 seconds', status='running', last_attempt_at=clock_timestamp(), error_code=null, next_retry_at=null where job=${job}`)
        await execute(sql`insert into public.ingestion_runs(id,job,started_at,status) values (${runId},${job},clock_timestamp(),'running')`)
        return { status: 'claimed', runId, cursor: sameScope ? Number(row.cursor) : 0 }
      })
    },
    async complete(job: JobId, token: string, batch: IngestionBatch, ttlMs: number) {
      // Validate the whole batch before starting observation writes.
      const observations = batch.observations.map(o => observationSchema.parse(o))
      if (observations.some(o => o.job !== job) || !Number.isInteger(batch.nextCursor) || batch.nextCursor < 0) throw new Error('invalid_batch')
      await db().transaction(async execute => {
        const rows = await execute(sql`select job from public.ingestion_state where job=${job} and lease_token=${token} and lease_until>clock_timestamp() for update`)
        if (!rows.length) throw new Error('lease_lost')
        // A batch may include the same HS classification from several country records.
        const unique = [...new Map(observations.map(o => [o.recordKey, o])).values()]
        if (unique.length) {
          const values = unique.map(o => sql`(${o.job},${o.provider},${o.recordKey},${o.sourceId},${o.sourceUrl},${o.license},${o.data.kind},${o.nature},${o.observedAt},${o.fetchedAt},${o.expiresAt},${o.sourceUpdatedAt},${JSON.stringify(o.data)}::jsonb)`)
          await execute(sql`insert into public.provider_observations(job,provider,record_key,source_id,source_url,license,kind,nature,observed_at,fetched_at,expires_at,source_updated_at,data)
            values ${sql.join(values, sql`, `)} on conflict(job,record_key) do update set
            provider=excluded.provider, source_id=excluded.source_id, source_url=excluded.source_url, license=excluded.license,
            kind=excluded.kind, nature=excluded.nature, observed_at=excluded.observed_at, fetched_at=excluded.fetched_at,
            expires_at=excluded.expires_at, source_updated_at=excluded.source_updated_at, data=excluded.data`)
        }
        await execute(sql`update public.ingestion_state set status='success', last_success_at=clock_timestamp(), expires_at=clock_timestamp()+${ttlMs} * interval '1 millisecond', cursor=${batch.nextCursor}, coverage=${batch.coverage}, error_code=null, next_retry_at=null, lease_token=null, lease_until=null where job=${job} and lease_token=${token}`)
        await execute(sql`update public.ingestion_runs set status='success', count=${unique.length}, finished_at=clock_timestamp() where id=${token}`)
      })
    },
    async fail(job: JobId, token: string, errorCode: string, retryAfterMs: number, unconfigured = false) {
      await db().transaction(async execute => {
        const rows = await execute(sql`select job from public.ingestion_state where job=${job} and lease_token=${token} and lease_until>clock_timestamp() for update`)
        if (!rows.length) throw new Error('lease_lost')
        const status = unconfigured ? 'unconfigured' : 'failed'
        await execute(sql`update public.ingestion_state set status=${status}, error_code=${errorCode}, next_retry_at=clock_timestamp()+${retryAfterMs} * interval '1 millisecond', lease_token=null, lease_until=null where job=${job} and lease_token=${token}`)
        await execute(sql`update public.ingestion_runs set status=${status}, error_code=${errorCode}, finished_at=clock_timestamp() where id=${token}`)
      })
    },
    async status() {
      const rows = await db().execute(sql`select public.ingestion_status() as value`)
      return rows.map(r => providerStatusSchema.parse(r.value))
    },
  }
}
