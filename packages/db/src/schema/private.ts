import { sql } from 'drizzle-orm'
import { check, foreignKey, index, integer, jsonb, numeric, pgSchema, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import type { ScenarioInput, SimulationOutput, RouteRequest } from '@altair/shared/contracts'
import { locations, products, suppliers, transportConnections } from './reference'

// Reference only: drizzle-kit must generate migrations for public, never auth.users.
const authUsers = pgSchema('auth').table('users', { id: uuid('id').primaryKey() })
const identity = () => ({
  id: uuid('id').defaultRandom().primaryKey(),
  ownerId: uuid('owner_id').notNull().references(() => authUsers.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const assistantConversations = pgTable('assistant_conversations', {
  ...identity(),
}, t => [unique('assistant_conversations_id_owner_unique').on(t.id, t.ownerId), index('assistant_conversations_owner_idx').on(t.ownerId)])

export const assistantTurns = pgTable('assistant_turns', {
  ...identity(), conversationId: uuid('conversation_id').notNull(), message: text('message').notNull(), response: jsonb('response'),
}, t => [
  foreignKey({ columns: [t.conversationId, t.ownerId], foreignColumns: [assistantConversations.id, assistantConversations.ownerId], name: 'assistant_turns_owner_conversation_fk' }).onDelete('cascade'),
  index('assistant_turns_owner_time_idx').on(t.ownerId, t.createdAt), index('assistant_turns_conversation_time_idx').on(t.conversationId, t.createdAt),
  check('assistant_turns_message_bounded', sql`length(trim(${t.message})) between 1 and 8000 and octet_length(${t.message}) <= 16000`),
  check('assistant_turns_response_bounded', sql`${t.response} is null or (jsonb_typeof(${t.response}) = 'object' and octet_length(${t.response}::text) <= 262144)`),
])

export const warehouses = pgTable('warehouses', {
  ...identity(),
  name: text('name').notNull(),
  locationId: uuid('location_id').references(() => locations.id),
}, (table) => [
  unique('warehouses_id_owner_unique').on(table.id, table.ownerId),
  index('warehouses_owner_idx').on(table.ownerId),
  check('warehouses_name_nonempty', sql`length(trim(${table.name})) > 0`),
])

export const shipments = pgTable('shipments', {
  ...identity(),
  trackingNumber: text('tracking_number'),
  productId: uuid('product_id').references(() => products.id),
  supplierId: uuid('supplier_id').references(() => suppliers.id),
  originId: uuid('origin_id').references(() => locations.id),
  destinationId: uuid('destination_id').references(() => locations.id),
  status: text('status').notNull().default('planned'),
  estimatedArrival: timestamp('estimated_arrival', { withTimezone: true }),
  inventoryId: uuid('inventory_id'),
  quantity: numeric('quantity', { precision: 18, scale: 6 }),
  unit: text('unit'),
  confirmedQuantity: numeric('confirmed_quantity', { precision: 18, scale: 6 }),
  verifiedUntil: timestamp('verified_until', { withTimezone: true }),
  routeRequest: jsonb('route_request').$type<RouteRequest>(),
}, (table) => [
  foreignKey({ columns: [table.inventoryId, table.ownerId], foreignColumns: [inventory.id, inventory.ownerId], name: 'shipments_owner_inventory_fk' }),
  index('shipments_inventory_owner_idx').on(table.inventoryId, table.ownerId),
  check('shipments_supply_valid', sql`(${table.quantity} is null or ${table.quantity} > 0) and (${table.confirmedQuantity} is null or (${table.quantity} is not null and ${table.confirmedQuantity} between 0 and ${table.quantity} and ${table.verifiedUntil} is not null)) and (${table.inventoryId} is null or (${table.quantity} is not null and length(trim(${table.unit})) > 0) is true)`),
  unique('shipments_id_owner_unique').on(table.id, table.ownerId),
  index('shipments_owner_created_idx').on(table.ownerId, table.createdAt),
  index('shipments_product_idx').on(table.productId),
  check('shipments_status_valid', sql`${table.status} in ('planned', 'in_transit', 'delivered', 'delayed', 'cancelled')`),
])

export const inventory = pgTable('inventory', {
  ...identity(),
  warehouseId: uuid('warehouse_id').notNull(),
  productId: uuid('product_id').notNull().references(() => products.id),
  quantity: numeric('quantity', { precision: 16, scale: 3 }).notNull().default('0'),
  unit: text('unit').notNull(),
  reservedQuantity: numeric('reserved_quantity', { precision: 16, scale: 3 }).notNull().default('0'),
  historyStart: timestamp('history_start', { withTimezone: true }),
}, (table) => [
  unique('inventory_id_owner_unique').on(table.id, table.ownerId),
  check('inventory_reservations_valid', sql`${table.reservedQuantity} >= 0 and ${table.reservedQuantity} <= ${table.quantity}`),
  check('inventory_unit_nonempty', sql`length(trim(${table.unit})) > 0`),
  foreignKey({ columns: [table.warehouseId, table.ownerId], foreignColumns: [warehouses.id, warehouses.ownerId], name: 'inventory_owner_warehouse_fk' }).onDelete('cascade'),
  unique('inventory_warehouse_product_unique').on(table.warehouseId, table.productId),
  index('inventory_owner_idx').on(table.ownerId),
  index('inventory_product_idx').on(table.productId),
  check('inventory_quantity_nonnegative', sql`${table.quantity} >= 0`),
])

export const inventoryMovements = pgTable('inventory_movements', {
  ...identity(), inventoryId: uuid('inventory_id').notNull(), kind: text('kind').notNull(),
  quantity: numeric('quantity', { precision: 16, scale: 3 }).notNull(), unit: text('unit').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(), idempotencyKey: text('idempotency_key').notNull(),
}, t => [
  foreignKey({ columns: [t.inventoryId, t.ownerId], foreignColumns: [inventory.id, inventory.ownerId], name: 'movements_owner_inventory_fk' }),
  unique('movements_owner_key_unique').on(t.ownerId, t.idempotencyKey),
  index('movements_inventory_time_idx').on(t.inventoryId, t.occurredAt), index('movements_owner_idx').on(t.ownerId),
  check('movements_quantity_positive', sql`${t.quantity} > 0`),
  check('movements_kind_valid', sql`${t.kind} in ('receipt','consumption','adjustment_in','adjustment_out')`),
])

export const plannedOrders = pgTable('planned_orders', {
  ...identity(), inventoryId: uuid('inventory_id').notNull(), quantity: numeric('quantity', { precision: 16, scale: 3 }).notNull(),
  reservedQuantity: numeric('reserved_quantity', { precision: 16, scale: 3 }).notNull().default('0'),
  unit: text('unit').notNull(), dueAt: timestamp('due_at', { withTimezone: true }).notNull(), status: text('status').notNull().default('planned'),
}, t => [
  foreignKey({ columns: [t.inventoryId, t.ownerId], foreignColumns: [inventory.id, inventory.ownerId], name: 'orders_owner_inventory_fk' }),
  index('orders_inventory_due_idx').on(t.inventoryId, t.dueAt), index('orders_owner_idx').on(t.ownerId),
  check('orders_quantities_valid', sql`${t.quantity} > 0 and ${t.reservedQuantity} between 0 and ${t.quantity}`),
  check('orders_status_valid', sql`${t.status} in ('planned','confirmed','fulfilled','cancelled')`),
])

export const routeOptions = pgTable('route_options', {
  ...identity(),
  name: text('name').notNull(),
  connectionId: uuid('connection_id').references(() => transportConnections.id),
  estimatedCost: numeric('estimated_cost', { precision: 16, scale: 2 }),
  currencyCode: text('currency_code'),
}, (table) => [
  unique('route_options_id_owner_unique').on(table.id, table.ownerId),
  index('route_options_owner_idx').on(table.ownerId),
  check('route_options_cost_nonnegative', sql`${table.estimatedCost} is null or ${table.estimatedCost} >= 0`),
])

export const scenarios = pgTable('scenarios', {
  ...identity(),
  name: text('name').notNull(),
  results: text('results'),
  routeOptionId: uuid('route_option_id'),
  simulationInput: jsonb('simulation_input').$type<ScenarioInput>(),
  baselineSnapshot: jsonb('baseline_snapshot'),
  baselineHash: text('baseline_hash'),
  engineVersion: text('engine_version'),
  simulationOutput: jsonb('simulation_output').$type<SimulationOutput>(),
}, (table) => [
  foreignKey({ columns: [table.routeOptionId, table.ownerId], foreignColumns: [routeOptions.id, routeOptions.ownerId], name: 'scenarios_owner_route_fk' }),
  index('scenarios_owner_idx').on(table.ownerId),
  index('scenarios_owner_id_idx').on(table.ownerId, table.id),
  check('scenarios_snapshot_shape', sql`(${table.simulationInput} is null and ${table.baselineSnapshot} is null and ${table.baselineHash} is null and ${table.engineVersion} is null and ${table.simulationOutput} is null) or (jsonb_typeof(${table.simulationInput}) = 'object' and jsonb_typeof(${table.baselineSnapshot}) = 'object' and ${table.baselineHash} is not null and ${table.engineVersion} is not null) is true`),
])

export const alerts = pgTable('alerts', {
  ...identity(),
  title: text('title').notNull(),
  shipmentId: uuid('shipment_id'),
  readAt: timestamp('read_at', { withTimezone: true }),
  rule: text('rule'), dedupKey: text('dedup_key'), targetKind: text('target_kind'), targetId: uuid('target_id'),
  severity: text('severity').notNull().default('high'), state: text('state').notNull().default('open'),
  action: text('action'), evidence: jsonb('evidence').notNull().default([]),
  occurrence: integer('occurrence').notNull().default(1), notificationCount: integer('notification_count').notNull().default(0),
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }), resolvedAt: timestamp('resolved_at', { withTimezone: true }),
}, (table) => [
  foreignKey({ columns: [table.shipmentId, table.ownerId], foreignColumns: [shipments.id, shipments.ownerId], name: 'alerts_owner_shipment_fk' }),
  index('alerts_owner_created_idx').on(table.ownerId, table.createdAt),
  unique('alerts_owner_dedup_unique').on(table.ownerId, table.dedupKey),
  index('alerts_owner_state_id_idx').on(table.ownerId, table.state, table.id),
  check('alerts_state_valid', sql`${table.state} in ('open','acknowledged','resolved')`),
  check('alerts_severity_valid', sql`${table.severity} in ('low','medium','high','critical')`),
  check('alerts_counters_valid', sql`${table.occurrence} > 0 and ${table.notificationCount} >= 0`),
])

export const monitoringSettings = pgTable('monitoring_settings', {
  ownerId: uuid('owner_id').primaryKey().references(() => authUsers.id, { onDelete: 'cascade' }),
  config: jsonb('config').notNull().default({}), revision: uuid('revision').notNull().defaultRandom(),
  lastEvaluatedAt: timestamp('last_evaluated_at', { withTimezone: true }),
  lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }), errorCode: text('error_code'),
}, t => [check('monitoring_config_object', sql`jsonb_typeof(${t.config}) = 'object' and octet_length(${t.config}::text) <= 65536`)])
