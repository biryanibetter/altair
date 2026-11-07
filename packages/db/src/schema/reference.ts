import { sql } from 'drizzle-orm'
import { check, foreignKey, index, jsonb, numeric, pgTable, text, timestamp, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import type { NetworkEdge, RiskSignal } from '@altair/shared/contracts'

const identity = () => ({
  id: uuid('id').defaultRandom().primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const organizations = pgTable('organizations', {
  ...identity(),
  name: text('name').notNull(),
  countryCode: text('country_code'),
}, (table) => [check('organizations_name_nonempty', sql`length(trim(${table.name})) > 0`)])

export const locations = pgTable('locations', {
  ...identity(),
  name: text('name').notNull(),
  kind: text('kind').notNull(),
  countryCode: text('country_code').notNull(),
  code: text('code'),
  longitude: numeric('longitude', { precision: 10, scale: 6 }),
  latitude: numeric('latitude', { precision: 9, scale: 6 }),
}, (table) => [
  uniqueIndex('locations_code_unique').on(table.kind, table.code),
  index('locations_country_idx').on(table.countryCode),
  check('locations_kind_valid', sql`${table.kind} in ('port', 'airport', 'terminal', 'hub', 'city', 'border')`),
  check('locations_coordinates_valid', sql`(${table.longitude} is null and ${table.latitude} is null) or (${table.longitude} is not null and ${table.latitude} is not null and ${table.longitude} between -180 and 180 and ${table.latitude} between -90 and 90)`),
])

export const transportConnections = pgTable('transport_connections', {
  ...identity(),
  originId: uuid('origin_id').notNull().references(() => locations.id),
  destinationId: uuid('destination_id').notNull().references(() => locations.id),
  mode: text('mode').notNull(),
  typicalDurationHours: numeric('typical_duration_hours', { precision: 10, scale: 2 }),
  routingMetadata: jsonb('routing_metadata').$type<NetworkEdge['metadata']>(),
}, (table) => [
  index('connections_origin_idx').on(table.originId),
  index('connections_destination_idx').on(table.destinationId),
  check('connections_distinct_locations', sql`${table.originId} <> ${table.destinationId}`),
  check('connections_mode_valid', sql`${table.mode} in ('sea', 'air', 'land')`),
  check('connections_duration_positive', sql`${table.typicalDurationHours} is null or ${table.typicalDurationHours} > 0`),
  check('connections_metadata_valid', sql`${table.routingMetadata} is null or ((jsonb_typeof(${table.routingMetadata}) = 'object' and ${table.routingMetadata}->>'version' = '1' and jsonb_typeof(${table.routingMetadata}->'hypothetical') = 'boolean' and ${table.routingMetadata}->>'state' in ('open','closed','unknown')) is true)`),
])

export const products = pgTable('products', {
  ...identity(),
  name: text('name').notNull(),
  hsCode: text('hs_code'),
}, (table) => [check('products_name_nonempty', sql`length(trim(${table.name})) > 0`)])

export const suppliers = pgTable('suppliers', {
  ...identity(),
  name: text('name').notNull(),
  organizationId: uuid('organization_id').references(() => organizations.id),
  locationId: uuid('location_id').references(() => locations.id),
  website: text('website'),
  verificationStatus: text('verification_status').notNull().default('unverified'),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
}, (table) => [
  check('suppliers_verification_valid', sql`${table.verificationStatus} in ('unverified','verified','rejected') and (${table.verificationStatus} <> 'verified' or (${table.verifiedAt} is not null and ${table.expiresAt} > ${table.verifiedAt}) is true)`),
  index('suppliers_organization_idx').on(table.organizationId),
  index('suppliers_location_idx').on(table.locationId),
])

export const supplierEvidence = pgTable('supplier_evidence', {
  ...identity(), supplierId: uuid('supplier_id').notNull().references(() => suppliers.id, { onDelete: 'cascade' }),
  sourceUrl: text('source_url').notNull(), description: text('description').notNull(),
  observedAt: timestamp('observed_at', { withTimezone: true }).notNull(), expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(), status: text('status').notNull(),
}, t => [unique('supplier_evidence_id_supplier_unique').on(t.id, t.supplierId), index('supplier_evidence_supplier_idx').on(t.supplierId), check('supplier_evidence_valid', sql`${t.status} in ('confirmed','inferred') and ${t.expiresAt} >= ${t.observedAt}`)])

export const supplierProducts = pgTable('supplier_products', {
  ...identity(), supplierId: uuid('supplier_id').notNull().references(() => suppliers.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').references(() => products.id), hsCode: text('hs_code'), classification: text('classification'), evidenceId: uuid('evidence_id').notNull(),
}, t => [
  foreignKey({ columns: [t.evidenceId, t.supplierId], foreignColumns: [supplierEvidence.id, supplierEvidence.supplierId], name: 'supplier_products_evidence_fk' }),
  index('supplier_products_supplier_idx').on(t.supplierId), index('supplier_products_product_idx').on(t.productId), index('supplier_products_hs_idx').on(t.classification, t.hsCode),
  unique('supplier_products_evidence_unique').on(t.supplierId, t.productId, t.hsCode, t.classification, t.evidenceId),
  check('supplier_products_classification_valid', sql`(${t.productId} is not null or ${t.hsCode} is not null) and (${t.hsCode} is null or (${t.hsCode} ~ '^[0-9]{2,8}$' and ${t.classification} is not null))`),
])

export const supplierCapabilities = pgTable('supplier_capabilities', {
  ...identity(), supplierId: uuid('supplier_id').notNull().references(() => suppliers.id, { onDelete: 'cascade' }), name: text('name').notNull(), evidenceId: uuid('evidence_id').notNull(),
}, t => [
  foreignKey({ columns: [t.evidenceId, t.supplierId], foreignColumns: [supplierEvidence.id, supplierEvidence.supplierId], name: 'supplier_capabilities_evidence_fk' }),
  unique('supplier_capabilities_evidence_unique').on(t.supplierId, t.name, t.evidenceId), index('supplier_capabilities_supplier_idx').on(t.supplierId),
  check('supplier_capabilities_name_nonempty', sql`length(trim(${t.name})) > 0`),
])

export const dataSources = pgTable('data_sources', {
  ...identity(),
  name: text('name').notNull(),
  url: text('url'),
  license: text('license'),
}, (table) => [check('sources_name_nonempty', sql`length(trim(${table.name})) > 0`)])

export const disruptions = pgTable('disruptions', {
  ...identity(),
  title: text('title').notNull(),
  description: text('description'),
  locationId: uuid('location_id').references(() => locations.id),
  sourceId: uuid('source_id').references(() => dataSources.id),
  startsAt: timestamp('starts_at', { withTimezone: true }),
  endsAt: timestamp('ends_at', { withTimezone: true }),
}, (table) => [
  index('disruptions_location_idx').on(table.locationId),
  index('disruptions_source_idx').on(table.sourceId),
  check('disruptions_dates_ordered', sql`${table.endsAt} is null or ${table.startsAt} is null or ${table.endsAt} >= ${table.startsAt}`),
])

export const riskSignals = pgTable('risk_signals', {
  ...identity(),
  title: text('title').notNull(),
  severity: text('severity').notNull(),
  locationId: uuid('location_id').references(() => locations.id),
  disruptionId: uuid('disruption_id').references(() => disruptions.id),
  sourceId: uuid('source_id').references(() => dataSources.id),
  connectionId: uuid('connection_id').references(() => transportConnections.id),
  supplierId: uuid('supplier_id').references(() => suppliers.id),
  intelligenceMetadata: jsonb('intelligence_metadata').$type<RiskSignal>(),
}, (table) => [
  index('risk_signals_location_idx').on(table.locationId),
  index('risk_signals_disruption_idx').on(table.disruptionId),
  index('risk_signals_source_idx').on(table.sourceId),
  index('risk_signals_connection_idx').on(table.connectionId),
  index('risk_signals_supplier_idx').on(table.supplierId),
  check('risk_signals_severity_valid', sql`${table.severity} in ('low', 'medium', 'high', 'critical')`),
])
