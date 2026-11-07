import 'server-only'
import { createCatalogHandler, createShipmentHandler, InputError, type IntegrationStore } from '@altair/backend'
import { createSupabaseServerClient } from '../supabase/server'
import { getAuthenticatedUser } from '../supabase/auth'

export async function authenticatedIntegrationStore(): Promise<IntegrationStore | null> {
  const client = await createSupabaseServerClient(), user = await getAuthenticatedUser(client)
  if (!user) return null
  const invalid = (error: { code?: string }): never => {
    if (['23503','23514','22P02','22003'].includes(error.code ?? '')) throw new InputError('invalid_reference')
    throw Error('integration_storage_unavailable')
  }
  return {
    async list(resource, limit, cursor, countryCode) {
      let query = client.from(resource).select('*').order('id').limit(limit)
      if (resource === 'shipments' || resource === 'warehouses') query = query.eq('owner_id', user.id)
      if (cursor) query = query.gt('id', cursor)
      if (resource === 'locations' && countryCode) query = query.eq('country_code', countryCode)
      const { data, error } = await query
      if (error) throw Error('integration_list_unavailable')
      return data ?? []
    },
    async getShipment(id) {
      const { data, error } = await client.from('shipments').select('*').eq('owner_id', user.id).eq('id', id).maybeSingle()
      if (error) throw Error('shipment_unavailable')
      return data
    },
    async createWarehouse(input) {
      const { data, error } = await client.from('warehouses').insert({ name: input.name, location_id: input.locationId, owner_id: user.id }).select('*').single()
      if (error) invalid(error)
      return data
    },
    async createShipment(input) {
      const { data, error } = await client.from('shipments').insert({ owner_id: user.id, product_id: input.productId, supplier_id: input.supplierId, origin_id: input.originId, destination_id: input.destinationId, quantity: input.quantity, unit: input.unit, route_request: input.routeRequest }).select('*').single()
      if (error) invalid(error)
      return data
    },
  }
}
export const catalogHandler = (resource: 'products' | 'locations' | 'warehouses') => createCatalogHandler(resource, authenticatedIntegrationStore)
export const shipmentHandler = (action: 'list' | 'create' | 'read') => createShipmentHandler(action, authenticatedIntegrationStore)
