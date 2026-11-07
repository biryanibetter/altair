import { z } from 'zod'
import { routeAlternativeSchema } from './routing'
const status = z.enum(['planned', 'in_transit', 'delayed', 'delivered', 'cancelled'])
const base = { title: z.string().trim().min(1).max(200), note: z.string().trim().max(4000).default(''), source: z.enum(['owner', 'carrier_document']).default('owner'), idempotencyKey: z.string().min(1).max(100) }
export const shippingEventInputSchema = z.discriminatedUnion('kind', [
  z.object({ ...base, kind: z.literal('milestone'), status, occurredAt: z.iso.datetime(), estimatedArrival: z.iso.datetime().optional(), trackingNumber: z.string().max(200).optional() }).strict(),
  z.object({ ...base, kind: z.literal('note') }).strict(),
  z.object({ ...base, kind: z.enum(['route_saved','quotation_request','reroute_request']), payload: z.object({ alternative: routeAlternativeSchema }).optional() }).strict(),
  z.object({ ...base, kind: z.literal('partner_response'), requestId: z.uuid(), decision: z.enum(['confirmed','rejected']), note: z.string().trim().min(1).max(4000) }).strict(),
])
export const shippingEventSchema = z.object({ id: z.uuid(), shipment_id: z.uuid(), kind: z.string(), title: z.string(), note: z.string(), source: z.string(), occurred_at: z.iso.datetime(), created_at: z.iso.datetime(), payload: z.record(z.string(), z.unknown()), request_id: z.uuid().nullable(), decision: z.string().nullable() })
export const shippingEventsSchema = z.object({ data: z.array(shippingEventSchema), nextCursor: z.string().nullable() })
