import { z, ZodError } from 'zod'
import { locationSelectionSchema, productSelectionSchema, warehouseSelectionSchema, shipmentRecordSchema, warehouseWriteSchema, shipmentWriteSchema, selectionQuerySchema, ownerSelectionQuerySchema } from '@altair/shared/contracts'
import { InputError, jsonResponse, readJsonBody } from '../routing/http'

export interface IntegrationStore {
  list(resource: 'products' | 'locations' | 'warehouses' | 'shipments', limit: number, cursor?: string, countryCode?: string): Promise<unknown[]>
  getShipment(id: string): Promise<unknown | null>
  createWarehouse(input: Record<string, unknown>): Promise<unknown>
  createShipment(input: Record<string, unknown>): Promise<unknown>
}

const schemas = { products: productSelectionSchema, locations: locationSelectionSchema, warehouses: warehouseSelectionSchema, shipments: shipmentRecordSchema }
export function selectionFromRow(resource: keyof typeof schemas, value: unknown) {
  const row = value as Record<string, unknown>
  if (resource === 'locations') return locationSelectionSchema.parse({ id: row.id, name: row.name, kind: row.kind, countryCode: row.country_code, coordinates: row.longitude == null || row.latitude == null ? null : [Number(row.longitude), Number(row.latitude)] })
  if (resource === 'products') return productSelectionSchema.parse({ id: row.id, name: row.name, hsCode: row.hs_code })
  if (resource === 'warehouses') return warehouseSelectionSchema.parse({ id: row.id, name: row.name, locationId: row.location_id })
  const iso = (v: unknown) => v == null ? null : new Date(String(v)).toISOString()
  return shipmentRecordSchema.parse({ id: row.id, productId: row.product_id, originId: row.origin_id, destinationId: row.destination_id, supplierId: row.supplier_id, quantity: row.quantity, unit: row.unit, routeRequest: row.route_request, inventoryId: row.inventory_id, confirmedQuantity: row.confirmed_quantity, verifiedUntil: iso(row.verified_until), trackingNumber: row.tracking_number, status: row.status, estimatedArrival: iso(row.estimated_arrival), updatedAt: iso(row.updated_at) })
}
function parse<T>(fn: () => T): T { try { return fn() } catch (e) { if (e instanceof ZodError) throw new InputError('invalid_request'); throw e } }
function query(request: Request, owner = false) {
  const params = new URL(request.url).searchParams
  for (const key of params.keys()) if (params.getAll(key).length > 1) throw new InputError('invalid_query')
  return parse(() => (owner ? ownerSelectionQuerySchema : selectionQuerySchema).parse(Object.fromEntries(params)))
}
function page(resource: keyof typeof schemas, rows: unknown[], limit: number) {
  const data = rows.slice(0, limit).map(row => selectionFromRow(resource, row))
  return { data, nextCursor: rows.length > limit ? data.at(-1)?.id ?? null : null }
}
function failure(error: unknown) { return jsonResponse({ error: error instanceof InputError ? 'invalid_request' : 'service_unavailable' }, error instanceof InputError ? 400 : 503) }

export function createCatalogHandler(resource: 'products' | 'locations' | 'warehouses', authorize: () => Promise<IntegrationStore | null>) {
  return async (request: Request, action: 'list' | 'create' = 'list'): Promise<Response> => {
    try {
      const store = await authorize(); if (!store) return jsonResponse({ error: 'unauthorized' }, 401)
      if (action === 'create') {
        if (resource !== 'warehouses' || new URL(request.url).search) throw new InputError('invalid_request')
        const body = await readJsonBody(request), input = parse(() => warehouseWriteSchema.parse(body))
        return jsonResponse(selectionFromRow('warehouses', await store.createWarehouse(input)), 201)
      }
      const filters = query(request, resource !== 'locations')
      const countryCode = resource === 'locations' ? parse(() => selectionQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams))).countryCode : undefined
      return jsonResponse(page(resource, await store.list(resource, filters.limit + 1, filters.cursor, countryCode), filters.limit))
    } catch (error) { return failure(error) }
  }
}
export function createShipmentHandler(action: 'list' | 'create' | 'read', authorize: () => Promise<IntegrationStore | null>) {
  return async (request: Request, id?: string): Promise<Response> => {
    try {
      const store = await authorize(); if (!store) return jsonResponse({ error: 'unauthorized' }, 401)
      if (action === 'list') {
        const filters = query(request, true)
        return jsonResponse(page('shipments', await store.list('shipments', filters.limit + 1, filters.cursor), filters.limit))
      }
      if (new URL(request.url).search) throw new InputError('invalid_request')
      if (action === 'read') {
        const target = parse(() => z.uuid().parse(id)), row = await store.getShipment(target)
        return row ? jsonResponse(selectionFromRow('shipments', row)) : jsonResponse({ error: 'not_found' }, 404)
      }
      const body = await readJsonBody(request), input = parse(() => shipmentWriteSchema.parse(body))
      return jsonResponse(selectionFromRow('shipments', await store.createShipment(input)), 201)
    } catch (error) { return failure(error) }
  }
}
