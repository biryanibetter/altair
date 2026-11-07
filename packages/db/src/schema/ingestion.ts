import { sql } from 'drizzle-orm'
import { check, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { dataSources } from './reference'

export const providerObservations = pgTable('provider_observations', {
  id: uuid('id').defaultRandom().primaryKey(),
  job: text('job').notNull(), provider: text('provider').notNull(), recordKey: text('record_key').notNull(),
  sourceId: uuid('source_id').notNull().references(() => dataSources.id),
  sourceUrl: text('source_url').notNull(), license: text('license').notNull(), kind: text('kind').notNull(), nature: text('nature').notNull(),
  observedAt: timestamp('observed_at', { withTimezone: true }).notNull(),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  sourceUpdatedAt: timestamp('source_updated_at', { withTimezone: true }), data: jsonb('data').notNull(),
}, t => [
  uniqueIndex('observations_job_key_unique').on(t.job, t.recordKey),
  index('observations_kind_id_idx').on(t.kind, t.id), index('observations_job_id_idx').on(t.job, t.id),
  index('observations_source_idx').on(t.sourceId), index('observations_time_idx').on(t.observedAt),
  index('observations_traffic_identity_time_idx').on(sql`(${t.data}->>'providerId')`, t.observedAt.desc()).where(sql`${t.kind} = 'traffic'`),
  check('observations_nature_valid', sql`${t.nature} in ('live','historical','estimated','simulated')`),
  check('observations_kind_valid', sql`${t.kind} in ('trade','classification','dependency','weather','marine','news','aircraft','vessel','traffic','webcam')`),
  check('observations_expiry_valid', sql`${t.expiresAt} >= ${t.fetchedAt}`),
])

export const ingestionState = pgTable('ingestion_state', {
  scope: text('scope').notNull().default('default'),
  job: text('job').primaryKey(), status: text('status').notNull().default('never'),
  lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }), lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }), nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),
  errorCode: text('error_code'), cursor: integer('cursor').notNull().default(0), coverage: text('coverage').notNull().default('not-yet-synchronized'),
  leaseToken: uuid('lease_token'), leaseUntil: timestamp('lease_until', { withTimezone: true }),
}, t => [check('ingestion_cursor_valid', sql`${t.cursor} >= 0`), check('ingestion_status_valid', sql`${t.status} in ('never','running','success','failed','unconfigured')`)])

export const ingestionRuns = pgTable('ingestion_runs', {
  id: uuid('id').primaryKey(), job: text('job').notNull().references(() => ingestionState.job),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(), finishedAt: timestamp('finished_at', { withTimezone: true }),
  status: text('status').notNull(), count: integer('count').notNull().default(0), errorCode: text('error_code'),
}, t => [index('ingestion_runs_job_started_idx').on(t.job, t.startedAt), check('ingestion_run_status_valid', sql`${t.status} in ('running','success','failed','unconfigured','interrupted')`)])
