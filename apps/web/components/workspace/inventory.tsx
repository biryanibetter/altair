'use client'
import { useEffect, useState } from 'react'
import { forecastResponseSchema, inventoryPatchSchema, inventoryRecordSchema, inventoryWriteSchema, movementRecordSchema, movementWriteSchema, orderRecordSchema, orderWriteSchema } from '@altair/shared/contracts'
import { api } from '@/lib/client/api'
import { useData } from './data'
import { ActionForm, Empty, ErrorMessage, Evidence, Facts, Heading, Panel, Tag, date, shortId } from './common'

const iso = (value: FormDataEntryValue | null) => new Date(String(value)).toISOString()
type Forecast = ReturnType<typeof forecastResponseSchema.parse>

export function Inventory() {
  const data = useData()
  const [selected, setSelected] = useState<string | null>(null), [forecast, setForecast] = useState<Forecast | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState<unknown>(null), [message, setMessage] = useState('')
  useEffect(() => { if (!selected && data.inventory.length) setSelected(data.inventory[0].id) }, [data.inventory, selected])
  const record = data.inventory.find(i => i.id === selected) ?? null
  const options = data.inventory.map(i => ({ value: i.id, label: `${data.name('products', i.productId)} · ${data.name('warehouses', i.warehouseId)} · ${i.quantity} ${i.unit}` }))
  const productOptions = data.products.map(p => ({ value: p.id, label: p.name })), warehouseOptions = data.warehouses.map(w => ({ value: w.id, label: w.name }))
  return <>
    <Heading title="Inventory" description="Owner-scoped stock records, movements and orders. Forecasts are estimated from recorded history; missing demand is never replaced with invented data.">
      <ActionForm title="Create inventory record" description="Creates a stock record. Reserved quantity cannot exceed on-hand quantity." label="New stock record" path="/inventory" input={inventoryWriteSchema} output={inventoryRecordSchema} fields={[
        { key: 'productId', label: 'Product', options: productOptions }, { key: 'warehouseId', label: 'Warehouse', options: warehouseOptions },
        { key: 'quantity', label: 'On hand', hint: 'Up to three decimal places.' }, { key: 'unit', label: 'Unit' },
        { key: 'reservedQuantity', label: 'Reserved', value: '0' }, { key: 'historyStart', label: 'History start (optional)', type: 'datetime-local', required: false },
      ]} build={form => ({ productId: String(form.get('productId')), warehouseId: String(form.get('warehouseId')), quantity: String(form.get('quantity')), reservedQuantity: String(form.get('reservedQuantity') || '0'), unit: String(form.get('unit')), historyStart: form.get('historyStart') ? iso(form.get('historyStart')) : null })} onSuccess={() => data.refresh()} />
    </Heading>
    {Object.entries(data.errors).map(([key, value]) => <ErrorMessage key={key} error={value} />)}
    <div className="split-workspace">
      <section className="region">
        <header className="table-tools"><h2>Stock records</h2><span className="muted">{data.inventory.length} records</span></header>
        {data.inventory.length === 0 ? <Empty>{data.loading ? 'Loading inventory…' : 'No inventory record exists for this account.'}</Empty> : <div className="table-scroll"><table><thead><tr><th>Record</th><th>Product</th><th>Warehouse</th><th>On hand</th><th>Reserved</th><th>Available</th></tr></thead><tbody>{data.inventory.map(i => <tr key={i.id} className={i.id === selected ? 'selected' : ''} onClick={() => { setSelected(i.id); setForecast(null) }}><td className="mono">{shortId(i.id)}</td><td>{data.name('products', i.productId)}</td><td>{data.name('warehouses', i.warehouseId)}</td><td>{i.quantity} {i.unit}</td><td>{i.reservedQuantity}</td><td>{(Number(i.quantity) - Number(i.reservedQuantity)).toFixed(3)} {i.unit}</td></tr>)}</tbody></table></div>}
      </section>
      <aside className="detail-region">
        {!record ? <Empty>Select a stock record.</Empty> : <>
          <header className="detail-header"><div><span className="eyebrow">Stock record</span><h2>{shortId(record.id)}</h2></div><Tag>{record.unit}</Tag></header>
          <Facts entries={[['Product', data.name('products', record.productId)], ['Warehouse', data.name('warehouses', record.warehouseId)], ['On hand', `${record.quantity} ${record.unit}`], ['Reserved', record.reservedQuantity], ['Available', `${(Number(record.quantity) - Number(record.reservedQuantity)).toFixed(3)} ${record.unit}`], ['History start', date(record.historyStart)]]} />
          <div className="button-row">
            <ActionForm title="Adjust reservation" description="Updates reserved quantity or history start only. Stock quantity changes require a recorded movement." label="Adjust" path={`/inventory/${record.id}`} method="PATCH" input={inventoryPatchSchema} output={inventoryRecordSchema} fields={[{ key: 'reservedQuantity', label: 'Reserved quantity', value: record.reservedQuantity }, { key: 'historyStart', label: 'History start (optional)', type: 'datetime-local', required: false }]} build={form => ({ reservedQuantity: String(form.get('reservedQuantity')), ...(form.get('historyStart') ? { historyStart: iso(form.get('historyStart')) } : {}) })} onSuccess={() => data.refresh()} />
            <ActionForm title="Record movement" description="Appends a receipt, consumption or adjustment. Idempotency prevents duplicate movements." label="Movement" path="/inventory/movements" input={movementWriteSchema} output={movementRecordSchema} fields={[{ key: 'inventoryId', label: 'Stock record', options, value: record.id }, { key: 'kind', label: 'Movement', options: ['receipt', 'consumption', 'adjustment_in', 'adjustment_out'].map(v => ({ value: v, label: v.replaceAll('_', ' ') })) }, { key: 'quantity', label: 'Quantity' }, { key: 'unit', label: 'Unit', value: record.unit }, { key: 'occurredAt', label: 'Occurred at', type: 'datetime-local' }]} build={form => ({ inventoryId: String(form.get('inventoryId')), kind: String(form.get('kind')), quantity: String(form.get('quantity')), unit: String(form.get('unit')), occurredAt: iso(form.get('occurredAt')), idempotencyKey: crypto.randomUUID() })} onSuccess={() => data.refresh()} />
            <ActionForm title="Create order" description="Creates a demand order against this stock record. The current API exposes creation and updates, not an order listing." label="Order" path="/inventory/orders" input={orderWriteSchema} output={orderRecordSchema} fields={[{ key: 'inventoryId', label: 'Stock record', options, value: record.id }, { key: 'quantity', label: 'Quantity' }, { key: 'reservedQuantity', label: 'Reserved', value: '0' }, { key: 'unit', label: 'Unit', value: record.unit }, { key: 'dueAt', label: 'Due at', type: 'datetime-local' }, { key: 'status', label: 'Status', options: ['planned', 'confirmed', 'fulfilled', 'cancelled'].map(v => ({ value: v, label: v })) }]} build={form => ({ inventoryId: String(form.get('inventoryId')), quantity: String(form.get('quantity')), reservedQuantity: String(form.get('reservedQuantity') || '0'), unit: String(form.get('unit')), dueAt: iso(form.get('dueAt')), status: String(form.get('status')) })} onSuccess={data => setMessage(`Order ${shortId(data.id)} created with status ${data.status}.`)} />
          </div>
          {message ? <p role="status">{message}</p> : null}
          <Panel title="Demand forecast">
            <form className="form-grid" onSubmit={async event => { event.preventDefault(); if (busy) return; const form = new FormData(event.currentTarget); setBusy(true); setError(null); try { const result = await api('/forecasts', forecastResponseSchema, { method: 'POST', body: { inventoryId: record.id, historyDays: Number(form.get('historyDays')), horizonDays: Number(form.get('horizonDays')), coverageDays: Number(form.get('coverageDays')), safetyStock: String(form.get('safetyStock')), leadTimeDays: form.get('leadTimeDays') ? Number(form.get('leadTimeDays')) : null, leadTimeAlternatives: [], dailyDemand: form.get('dailyDemand') ? Number(form.get('dailyDemand')) : undefined } }); setForecast(result) } catch (e) { setError(e) } finally { setBusy(false) } }}>
              <label><span>History days</span><input name="historyDays" type="number" min={1} max={365} defaultValue={28} required /></label>
              <label><span>Horizon days</span><input name="horizonDays" type="number" min={1} max={365} defaultValue={90} required /></label>
              <label><span>Coverage days</span><input name="coverageDays" type="number" min={0} max={365} defaultValue={30} required /></label>
              <label><span>Safety stock</span><input name="safetyStock" inputMode="decimal" defaultValue="0" required /></label>
              <label><span>Lead time (days, optional)</span><input name="leadTimeDays" type="number" min={0} max={365} step="any" /></label>
              <label><span>Explicit daily demand (optional)</span><input name="dailyDemand" type="number" min={0} step="any" /></label>
              <div className="form-actions wide"><button className="primary-action" type="submit" disabled={busy}>{busy ? 'Forecasting…' : 'Run forecast'}</button></div>
            </form>
            <ErrorMessage error={error} />
            {forecast ? <><Facts entries={[['Method', forecast.consumption.method.replaceAll('_', ' ') + (forecast.nature === 'simulated' ? ' · simulated scenario' : '')], ['Average daily', forecast.consumption.averageDaily ?? 'Unavailable'], ['Coverage', forecast.coverageDays == null ? 'Unavailable' : `${forecast.coverageDays.toFixed(1)} days`], ['Stockout at', date(forecast.stockoutAt)], ['Reorder point', forecast.reorderPoint ?? 'Unavailable'], ['Suggested order', forecast.suggestedQuantity ?? 'Unavailable'], ['Recommended order at', date(forecast.recommendedOrderAt)]]} />
              {forecast.limitations.length ? <ul className="compact-list">{forecast.limitations.map(l => <li key={l}>{l}</li>)}</ul> : null}
              <Evidence title="Forecast projection and uncertainty" value={{ projection: forecast.projection.slice(0, 20), uncertainty: forecast.consumption.uncertainty, leadTimeRisks: forecast.leadTimeRisks }} /></> : <p className="muted">Run a forecast to see estimated coverage, reorder point and limitations.</p>}
          </Panel>
        </>}
      </aside>
    </div>
  </>
}
