import { z } from 'zod'
export * from './ingestion'
export * from './routing'
export * from './intelligence'
export * from './scenarios'

const uuid = z.uuid()
const name = z.string().trim().min(1).max(200)
const optionalUuid = uuid.nullish()

export const organizationSchema = z.object({ name, countryCode: z.string().length(2).nullish() })
export const locationSchema = z.object({ name, kind: z.enum(['port', 'airport', 'hub', 'city', 'border']), countryCode: z.string().length(2), code: z.string().nullish() })
export const transportConnectionSchema = z.object({ originId: uuid, destinationId: uuid, mode: z.enum(['sea', 'air', 'land']), typicalDurationHours: z.number().positive().nullish() }).refine((data) => data.originId !== data.destinationId)
export const productSchema = z.object({ name, hsCode: z.string().nullish() })
export const supplierSchema = z.object({ name, organizationId: optionalUuid, locationId: optionalUuid, website: z.url().nullish() })
export const dataSourceSchema = z.object({ name, url: z.url().nullish(), license: z.string().nullish() })
export const disruptionSchema = z.object({ title: name, description: z.string().nullish(), locationId: optionalUuid, sourceId: optionalUuid, startsAt: z.iso.datetime().nullish(), endsAt: z.iso.datetime().nullish() })
export const riskSignalSchema = z.object({ title: name, severity: z.enum(['low', 'medium', 'high', 'critical']), locationId: optionalUuid, disruptionId: optionalUuid, sourceId: optionalUuid })

// Authenticated request handlers derive ownerId from a verified user, never from request input.
const owned = { ownerId: uuid }
export const warehouseSchema = z.object({ ...owned, name, locationId: optionalUuid })
export const shipmentSchema = z.object({ ...owned, trackingNumber: z.string().nullish(), productId: optionalUuid, supplierId: optionalUuid, originId: optionalUuid, destinationId: optionalUuid, status: z.enum(['planned', 'in_transit', 'delivered', 'delayed', 'cancelled']), estimatedArrival: z.iso.datetime().nullish() })
export const inventorySchema = z.object({ ...owned, warehouseId: uuid, productId: uuid, quantity: z.number().nonnegative(), unit: name })
export const routeOptionSchema = z.object({ ...owned, name, connectionId: optionalUuid, estimatedCost: z.number().nonnegative().nullish(), currencyCode: z.string().length(3).nullish() })
export const scenarioSchema = z.object({ ...owned, name, results: z.string().nullish(), routeOptionId: optionalUuid })
export const alertSchema = z.object({ ...owned, title: name, shipmentId: optionalUuid, readAt: z.iso.datetime().nullish() })

export type Location = z.infer<typeof locationSchema>
export type Shipment = z.infer<typeof shipmentSchema>
export type Inventory = z.infer<typeof inventorySchema>
export type RouteOption = z.infer<typeof routeOptionSchema>
export type Scenario = z.infer<typeof scenarioSchema>
export type Alert = z.infer<typeof alertSchema>
export * from './supply'
export * from './monitoring'
export * from './assistant'
export * from './integration'
export * from './shipping'
