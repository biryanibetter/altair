import { describe, expect, it } from 'vitest'
import { getTableConfig } from 'drizzle-orm/pg-core'
import * as reference from '../src/schema/reference'
import * as privateData from '../src/schema/private'

describe('data boundaries', () => {
  it('provides public catalog and intelligence tables', () => {
    expect(Object.values(reference).map((table) => getTableConfig(table).name).sort()).toEqual([
      'data_sources', 'disruptions', 'locations', 'organizations', 'products',
      'risk_signals', 'supplier_capabilities', 'supplier_evidence', 'supplier_products', 'suppliers', 'transport_connections',
    ])
  })

  it('provides owned shipment, inventory, workspace and alert records', () => {
    expect(Object.values(privateData).map((table) => getTableConfig(table).name).sort()).toEqual([
      'alerts', 'assistant_conversations', 'assistant_turns', 'inventory', 'inventory_movements', 'monitoring_settings', 'planned_orders', 'route_options', 'scenarios', 'shipments', 'warehouses',
    ])
    for (const table of Object.values(privateData)) {
      const info = getTableConfig(table)
      expect(info.columns.map((column) => column.name)).toContain('owner_id')
      expect(info.indexes.length > 0 || info.columns.some(column => column.name === 'owner_id' && column.primary)).toBe(true)
    }
  })
})
