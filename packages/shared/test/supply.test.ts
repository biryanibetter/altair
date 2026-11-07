import { expect, it } from 'vitest'
import { forecastRequestSchema, inventoryWriteSchema, supplierSearchSchema, replenishmentWriteSchema } from '../src/contracts'

const id = '10000000-0000-4000-8000-000000000001'
it('rejects invented owners, excess reservations and inventory precision that would silently round', () => {
  const stock = { productId: id, warehouseId: id, quantity: '10', unit: 'kg' }
  expect(inventoryWriteSchema.safeParse({ ...stock, ownerId: id }).success).toBe(false)
  expect(inventoryWriteSchema.safeParse({ ...stock, reservedQuantity: '11' }).success).toBe(false)
  expect(inventoryWriteSchema.safeParse({ ...stock, quantity: '0.0001' }).success).toBe(false)
})
it('requires explicit HS classifications and bounds forecasting resources', () => {
  expect(supplierSearchSchema.safeParse({ hsCode: '1006' }).success).toBe(false)
  expect(forecastRequestSchema.safeParse({ inventoryId: id, horizonDays: 366 }).success).toBe(false)
  expect(forecastRequestSchema.safeParse({ inventoryId: id, leadTimeDays: -1 }).success).toBe(false)
})
it('cannot record confirmed supplier quantity without verification expiry or above the requested quantity', () => {
  const record = { inventoryId: id, quantity: '10', unit: 'kg', routeRequest: null, confirmedQuantity: '10', verifiedUntil: null }
  expect(replenishmentWriteSchema.safeParse(record).success).toBe(false)
  expect(replenishmentWriteSchema.safeParse({ ...record, confirmedQuantity: '11', verifiedUntil: '2027-01-01T00:00:00.000Z' }).success).toBe(false)
})
