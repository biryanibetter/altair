'use client'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { z } from 'zod'
import { locationListSchema, productListSchema, warehouseListSchema, shipmentListSchema, inventoryListResponseSchema, alertRecordSchema } from '@altair/shared/contracts'
import { collectPages } from '@/lib/client/api'

const alertsSchema = z.object({ data: z.array(alertRecordSchema), nextCursor: z.string().nullable() })
type Data = { locations: z.infer<typeof locationListSchema>['data']; products: z.infer<typeof productListSchema>['data']; warehouses: z.infer<typeof warehouseListSchema>['data']; shipments: z.infer<typeof shipmentListSchema>['data']; inventory: z.infer<typeof inventoryListResponseSchema>['data']; alerts: z.infer<typeof alertsSchema>['data'] }
const empty: Data = { locations: [], products: [], warehouses: [], shipments: [], inventory: [], alerts: [] }
const Context = createContext<Data & { loading: boolean; errors: Record<string, Error>; refresh: () => void; name: (kind: 'locations' | 'products' | 'warehouses', id: string) => string }>({ ...empty, loading: true, errors: {}, refresh: () => {}, name: (_, id) => id })
export function DataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState(empty), [loading, setLoading] = useState(true), [errors, setErrors] = useState<Record<string, Error>>({}), [revision, setRevision] = useState(0)
  const refresh = useCallback(() => setRevision(v => v + 1), [])
  useEffect(() => {
    const controller = new AbortController(); setLoading(true)
    const load = async <K extends keyof Data>(key: K, schema: z.ZodType<{ data: Data[K][number][]; nextCursor: string | null }>) => {
      try { const rows = await collectPages(`/${key}`, schema, controller.signal); if (!controller.signal.aborted) { setData(current => ({ ...current, [key]: rows })); setErrors(current => { const next = { ...current }; delete next[key]; return next }) } }
      catch (error) { if (!controller.signal.aborted) setErrors(current => ({ ...current, [key]: error as Error })) }
    }
    void Promise.all([load('locations', locationListSchema), load('products', productListSchema), load('warehouses', warehouseListSchema), load('shipments', shipmentListSchema), load('inventory', inventoryListResponseSchema), load('alerts', alertsSchema)]).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [revision])
  const value = useMemo(() => ({ ...data, loading, errors, refresh, name: (kind: 'locations' | 'products' | 'warehouses', id: string) => data[kind].find(row => row.id === id)?.name ?? id.slice(0, 8) }), [data, loading, errors, refresh])
  return <Context.Provider value={value}>{children}</Context.Provider>
}
export const useData = () => useContext(Context)
