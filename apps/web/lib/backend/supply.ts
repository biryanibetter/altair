import 'server-only'
import { createSupplyHandler, inventoryFromRow, movementFromRow, orderFromRow, replenishmentFromRow, supplyFromRows, suppliersFromRows, scenarioFromRow, intelligenceFromRows, tradeFromRows, InputError, type SupplyStore, type SupplyAction } from '@altair/backend'
import { createSupabaseServerClient } from '../supabase/server'
import { getAuthenticatedUser } from '../supabase/auth'

const columns: Record<string, string> = { productId: 'product_id', warehouseId: 'warehouse_id', reservedQuantity: 'reserved_quantity', historyStart: 'history_start', inventoryId: 'inventory_id', occurredAt: 'occurred_at', idempotencyKey: 'idempotency_key', dueAt: 'due_at', confirmedQuantity: 'confirmed_quantity', verifiedUntil: 'verified_until', routeRequest: 'route_request' }
function storageError(error: { code?: string }) {
  if (['23503', '23514', '22003', '22P02', 'P0001', '23505'].includes(error.code ?? '')) throw new InputError('invalid_or_conflicting_supply_record')
  throw Error('supply_storage_unavailable')
}
export async function authenticatedSupplyStore(context?: { client: Awaited<ReturnType<typeof createSupabaseServerClient>>; user: { id: string } }): Promise<SupplyStore | null> {
  const client = context?.client ?? await createSupabaseServerClient(), user = context?.user ?? await getAuthenticatedUser(client)
  if (!user) return null
  return {
    async list(q) {
      let query = client.from('inventory').select('*').eq('owner_id', user.id).order('id').limit(q.limit + 1)
      if (q.productId) query = query.eq('product_id', q.productId)
      if (q.warehouseId) query = query.eq('warehouse_id', q.warehouseId)
      if (q.cursor) query = query.gt('id', q.cursor)
      const { data, error } = await query
      if (error) throw Error('inventory_unavailable')
      return (data ?? []).map(inventoryFromRow)
    },
    async write(action, input, id) {
      const payload = Object.fromEntries(Object.entries(input).map(([k, v]) => [columns[k] ?? k, v]))
      const table = action === 'create' || action === 'patch' ? 'inventory' : action === 'movement' ? 'inventory_movements' : action === 'replenishment' ? 'shipments' : 'planned_orders'
      const isUpdate = action === 'patch' || action === 'updateOrder' || action === 'replenishment'
      const query = isUpdate ? client.from(table).update(payload).eq('owner_id', user.id).eq('id', id!) : client.from(table).insert({ ...payload, owner_id: user.id })
      const { data, error } = await query.select('*').maybeSingle()
      if (error) storageError(error)
      if (!data) return null
      return action === 'movement' ? movementFromRow(data) : action === 'order' || action === 'updateOrder' ? orderFromRow(data) : action === 'replenishment' ? replenishmentFromRow(data) : inventoryFromRow(data)
    },
    async snapshot(id) {
      const { data, error } = await client.rpc('supply_inventory_snapshot', { stock_id: id })
      if (error) throw Error('supply_snapshot_unavailable')
      return data ? supplyFromRows(data) : null
    },
    async scenario(id) {
      const { data, error } = await client.from('scenarios').select('*').eq('owner_id', user.id).eq('id', id).not('simulation_input', 'is', null).maybeSingle()
      if (error) throw Error('scenario_unavailable')
      return data ? scenarioFromRow(data) : null
    },
    async suppliers() {
      const { data, error } = await client.rpc('supply_supplier_snapshot')
      if (error) throw Error('supplier_catalog_unavailable')
      return suppliersFromRows(data)
    },
    async trade(filters) {
      const { data, error } = await client.rpc('supply_trade_snapshot', { filters })
      if (error) throw Error('trade_unavailable')
      return tradeFromRows(data)
    },
    async intelligence() {
      const { data, error } = await client.rpc('intelligence_snapshot')
      if (error) throw Error('intelligence_unavailable')
      return intelligenceFromRows(data, new Date().toISOString())
    },
  }
}
export const supplyHandler = (action: SupplyAction) => createSupplyHandler(action, authenticatedSupplyStore)
