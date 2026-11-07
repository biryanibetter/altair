// ALTAIR Backend Integration - With Demo Mode Support
import 'server-only'
import { createCatalogHandler, createShipmentHandler, InputError, type IntegrationStore } from '@altair/backend'
import { createSupabaseServerClient } from '../supabase/server'
import { getAuthenticatedUser, isDemoRequest } from '../supabase/auth'
import { demoLocations, demoProducts, demoWarehouses, getDemoState, setDemoState } from '@/lib/demo/data'

export async function authenticatedIntegrationStore(): Promise<IntegrationStore | null> {
  // In demo mode, use demo data
  if (isDemoRequest()) {
    return {
      async list(resource, limit = 100, cursor, countryCode) {
        let data: unknown[] = []
        
        switch (resource) {
          case 'locations':
            data = demoLocations.filter(l => !countryCode || l.countryCode === countryCode)
            break
          case 'products':
            data = demoProducts
            break
          case 'warehouses':
            data = demoWarehouses
            break
          case 'shipments': {
            const state = getDemoState()
            data = state.shipments
            break
          }
          default:
            data = []
        }
        
        if (cursor) {
          const cursorIndex = data.findIndex((item: { id: string }) => item.id === cursor)
          if (cursorIndex >= 0) data = data.slice(cursorIndex + 1)
        }
        
        return data.slice(0, limit)
      },
      
      async getShipment(id) {
        const state = getDemoState()
        return state.shipments.find(s => s.id === id) || null
      },
      
      async createWarehouse(input) {
        return {
          id: `demo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          ownerId: 'demo-owner',
          name: input.name,
          locationId: input.locationId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      },
      
      async createShipment(input: { productId: string; supplierId?: string | null; originId: string; destinationId: string; quantity: string; unit: string; routeRequest?: { originId: string; destinationId: string; shipment: { massKg?: number; volumeM3?: number; commodity?: string; handling: string[] }; preferences?: { modes?: ('land' | 'sea' | 'air')[]; allowHypothetical?: boolean; enrichGeometry?: boolean }; constraints?: { maxDurationHours?: number; maxCost?: { amount: string; currency: string }; maxHops?: number; maxExpansions?: number; maxAlternatives?: number; requireConfirmed?: boolean; minConfidence?: number; excludedNodeIds?: string[]; excludedEdgeIds?: string[] }; priorities?: { cost?: number; time?: number; risk?: number } } | null }) {
        const state = getDemoState()
        const newShipment = {
          id: `demo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          ownerId: 'demo-owner',
          trackingNumber: `MED-QTR-2026-${String(state.shipments.length + 1).padStart(3, '0')}`,
          productId: input.productId,
          supplierId: input.supplierId ?? null,
          originId: input.originId,
          destinationId: input.destinationId,
          quantity: input.quantity,
          unit: input.unit,
          routeRequest: input.routeRequest ? { 
        ...input.routeRequest, 
        shipment: { ...input.routeRequest.shipment, handling: input.routeRequest.shipment.handling ?? [] },
        preferences: { 
          modes: (input.routeRequest.preferences?.modes ?? ['land', 'sea', 'air']) as ('land' | 'sea' | 'air')[], 
          allowHypothetical: input.routeRequest.preferences?.allowHypothetical ?? false, 
          enrichGeometry: input.routeRequest.preferences?.enrichGeometry ?? false 
        },
        constraints: { 
          maxHops: input.routeRequest.constraints?.maxHops ?? 6, 
          maxExpansions: input.routeRequest.constraints?.maxExpansions ?? 5000, 
          maxAlternatives: input.routeRequest.constraints?.maxAlternatives ?? 10, 
          requireConfirmed: input.routeRequest.constraints?.requireConfirmed ?? false, 
          minConfidence: input.routeRequest.constraints?.minConfidence ?? 0, 
          excludedNodeIds: input.routeRequest.constraints?.excludedNodeIds ?? [], 
          excludedEdgeIds: input.routeRequest.constraints?.excludedEdgeIds ?? [],
          maxDurationHours: input.routeRequest.constraints?.maxDurationHours,
          maxCost: input.routeRequest.constraints?.maxCost,
        },
        priorities: { 
        cost: input.routeRequest.priorities?.cost ?? 1, 
        time: input.routeRequest.priorities?.time ?? 1, 
        risk: input.routeRequest.priorities?.risk ?? 1 
      },
      } : null,
          inventoryId: null,
          confirmedQuantity: null,
          status: 'planned' as const,
          estimatedArrival: null,
          verifiedUntil: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        state.shipments.push(newShipment)
        state.createdShipments.push(newShipment.id)
        setDemoState(state)
        return newShipment
      },
    }
  }
  
  const client = await createSupabaseServerClient()
  const user = await getAuthenticatedUser(client)
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