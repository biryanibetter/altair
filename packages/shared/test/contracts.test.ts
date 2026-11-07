import { describe, expect, it } from 'vitest'
import { shipmentSchema, locationSchema, inventorySchema } from '../src/contracts'

describe('shared contracts', () => {
  it('rejects an unsupported location kind', () => {
    expect(locationSchema.safeParse({ name: 'Hamad Port', kind: 'unknown', countryCode: 'QA' }).success).toBe(false)
  })
  it('rejects negative private inventory', () => {
    expect(inventorySchema.safeParse({ ownerId: crypto.randomUUID(), warehouseId: crypto.randomUUID(), productId: crypto.randomUUID(), quantity: -1, unit: 'kg' }).success).toBe(false)
  })
  it('accepts a shipment owned by a user', () => {
    expect(shipmentSchema.safeParse({ ownerId: crypto.randomUUID(), status: 'planned' }).success).toBe(true)
  })
})
