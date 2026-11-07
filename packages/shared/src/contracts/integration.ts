import { z } from 'zod'
import { amountSchema, routeRequestSchema } from './routing'

export const selectionQuerySchema = z.object({ limit: z.coerce.number().int().min(1).max(100).default(50), cursor: z.uuid().optional(), countryCode: z.string().length(2).optional() }).strict()
export const ownerSelectionQuerySchema = selectionQuerySchema.omit({ countryCode: true })
export const locationSelectionSchema = z.object({ id: z.uuid(), name: z.string(), kind: z.enum(['port','airport','terminal','hub','city','border']), countryCode: z.string().length(2), coordinates: z.tuple([z.number(), z.number()]).nullable() }).strict()
export const productSelectionSchema = z.object({ id: z.uuid(), name: z.string(), hsCode: z.string().nullable() }).strict()
export const warehouseSelectionSchema = z.object({ id: z.uuid(), name: z.string(), locationId: z.uuid().nullable() }).strict()
export const warehouseWriteSchema = z.object({ name: z.string().trim().min(1).max(200), locationId: z.uuid().nullable().default(null) }).strict()
export const shipmentWriteSchema = z.object({ productId: z.uuid(), originId: z.uuid(), destinationId: z.uuid(), supplierId: z.uuid().nullable().default(null), quantity: amountSchema.refine(v => Number(v) > 0), unit: z.string().trim().min(1).max(80), routeRequest: routeRequestSchema.nullable().default(null) }).strict().refine(v => v.originId !== v.destinationId && (!v.routeRequest || v.routeRequest.originId === v.originId && v.routeRequest.destinationId === v.destinationId), 'shipment_route_mismatch')
export const shipmentRecordSchema = z.object({ id: z.uuid(), productId: z.uuid(), originId: z.uuid(), destinationId: z.uuid(), supplierId: z.uuid().nullable(), quantity: amountSchema, unit: z.string(), routeRequest: routeRequestSchema.nullable(), inventoryId: z.uuid().nullable(), confirmedQuantity: amountSchema.nullable(), verifiedUntil: z.iso.datetime().nullable(), trackingNumber: z.string().nullable(), status: z.enum(['planned','in_transit','delivered','delayed','cancelled']), estimatedArrival: z.iso.datetime().nullable(), updatedAt: z.iso.datetime() }).strict()
export const locationListSchema = z.object({ data: z.array(locationSelectionSchema), nextCursor: z.uuid().nullable() })
export const productListSchema = z.object({ data: z.array(productSelectionSchema), nextCursor: z.uuid().nullable() })
export const warehouseListSchema = z.object({ data: z.array(warehouseSelectionSchema), nextCursor: z.uuid().nullable() })
export const shipmentListSchema = z.object({ data: z.array(shipmentRecordSchema), nextCursor: z.uuid().nullable() })
