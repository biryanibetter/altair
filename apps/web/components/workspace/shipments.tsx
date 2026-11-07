'use client'
import { useEffect, useMemo, useState } from 'react'
import { replenishmentRecordSchema, replenishmentWriteSchema, shippingEventInputSchema, shippingEventSchema, shippingEventsSchema, shipmentRecordSchema, shipmentWriteSchema } from '@altair/shared/contracts'
import { collectPages } from '@/lib/client/api'
import { useData } from './data'
import { ActionForm, Empty, ErrorMessage, Evidence, Facts, Heading, Tag, date, shortId } from './common'
import type { Field } from './common'
import type { PageId } from './shell'

const statuses = ['planned', 'in_transit', 'delayed', 'delivered', 'cancelled'] as const
const iso = (value: FormDataEntryValue | null) => new Date(String(value)).toISOString()
const eventFields: Field[] = [{ key: 'title', label: 'Title' }, { key: 'note', label: 'Note', type: 'textarea' }]
const milestoneFields: Field[] = [...eventFields, { key: 'status', label: 'New shipment status', options: statuses.map(value => ({ value, label: value.replaceAll('_', ' ') })) }, { key: 'occurredAt', label: 'Occurred at', type: 'datetime-local' }, { key: 'trackingNumber', label: 'Tracking number (optional)', required: false }, { key: 'estimatedArrival', label: 'Estimated arrival (optional)', type: 'datetime-local', required: false }]
type ShipmentEvent = { id: string; kind: string; title: string; note: string; source: string; occurred_at: string; request_id: string | null; decision: string | null; payload: Record<string, unknown> }

export function Shipments({ navigate }: { navigate: (page: PageId) => void }) {
  const data = useData()
  const [query, setQuery] = useState(''), [status, setStatus] = useState(''), [selected, setSelected] = useState<string | null>(null)
  useEffect(() => {
    const read = () => { const value = new URLSearchParams(location.hash.split('?')[1] ?? '').get('id'); if (value) setSelected(value) }
    read(); window.addEventListener('hashchange', read); return () => window.removeEventListener('hashchange', read)
  }, [])
  useEffect(() => { if (!selected && data.shipments.length) setSelected(data.shipments[0].id) }, [data.shipments, selected])
  const rows = useMemo(() => data.shipments.filter(s => (!status || s.status === status) && (!query || `${s.id} ${s.trackingNumber ?? ''} ${data.name('products', s.productId)} ${data.name('locations', s.originId)} ${data.name('locations', s.destinationId)}`.toLowerCase().includes(query.toLowerCase()))), [data, query, status])
  const shipment = data.shipments.find(s => s.id === selected) ?? null
  const productOptions = data.products.map(p => ({ value: p.id, label: p.name }))
  const locationOptions = data.locations.map(l => ({ value: l.id, label: `${l.name} (${l.countryCode})` }))
  return <>
    <Heading title="Shipments" description="Owner-scoped lifecycle records. Milestones, notes, requests and responses are appended to an immutable audit trail.">
      <ActionForm title="Create shipment" description="Creates an owned shipment. A route request is optional and validated against the same origin and destination." label="New shipment" path="/shipments" input={shipmentWriteSchema} output={shipmentRecordSchema} fields={[
        { key: 'productId', label: 'Product', options: productOptions },
        { key: 'originId', label: 'Origin', options: locationOptions },
        { key: 'destinationId', label: 'Destination', options: locationOptions },
        { key: 'quantity', label: 'Quantity', hint: 'Decimal string, for example 120.5' },
        { key: 'unit', label: 'Unit' },
        { key: 'supplierId', label: 'Supplier ID (optional)', required: false, hint: 'Optional UUID from the supplier catalog.' },
      ]} build={form => ({ productId: String(form.get('productId')), originId: String(form.get('originId')), destinationId: String(form.get('destinationId')), quantity: String(form.get('quantity')), unit: String(form.get('unit')), supplierId: form.get('supplierId') ? String(form.get('supplierId')) : null, routeRequest: null })} onSuccess={() => data.refresh()} />
    </Heading>
    {Object.entries(data.errors).length ? <div className="notice">{Object.entries(data.errors).map(([key, error]) => <p key={key}><b>{key}</b>: {error.message}</p>)}</div> : null}
    <div className="split-workspace">
      <section className="region">
        <header className="table-tools"><input aria-label="Search shipments" placeholder="Search id, product, lane or tracking" value={query} onChange={e => setQuery(e.target.value)} /><select aria-label="Filter by status" value={status} onChange={e => setStatus(e.target.value)}><option value="">All statuses</option>{statuses.map(s => <option key={s} value={s}>{s.replaceAll('_', ' ')}</option>)}</select><span className="muted">{rows.length} of {data.shipments.length}</span></header>
        {rows.length === 0 ? <Empty>{data.loading ? 'Loading owned shipments…' : 'No shipment matches this filter.'}</Empty> : <div className="table-scroll"><table><thead><tr><th>Shipment</th><th>Product</th><th>Lane</th><th>Quantity</th><th>Status</th><th>ETA</th></tr></thead><tbody>{rows.map(s => <tr key={s.id} className={s.id === selected ? 'selected' : ''} onClick={() => { setSelected(s.id); history.replaceState(null, '', `#shipments?id=${s.id}`) }}><td className="mono">{shortId(s.id)}{s.trackingNumber ? <small>{s.trackingNumber}</small> : null}</td><td>{data.name('products', s.productId)}</td><td>{data.name('locations', s.originId)} → {data.name('locations', s.destinationId)}</td><td>{s.quantity} {s.unit}</td><td><Tag tone={s.status}>{s.status.replaceAll('_', ' ')}</Tag></td><td>{date(s.estimatedArrival)}</td></tr>)}</tbody></table></div>}
      </section>
      <aside className="detail-region">
        {!shipment ? <Empty>Select a shipment to inspect its lifecycle.</Empty> : <ShipmentDetail shipment={shipment} onChanged={data.refresh} navigate={navigate} />}
      </aside>
    </div>
  </>
}

function ShipmentDetail({ shipment, onChanged, navigate }: { shipment: ReturnType<typeof useData>['shipments'][number]; onChanged: () => void; navigate: (page: PageId) => void }) {
  const data = useData()
  const [events, setEvents] = useState<ShipmentEvent[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState<unknown>(null)
  const load = () => { setLoading(true); collectPages<ShipmentEvent>(`/shipments/${shipment.id}/events`, shippingEventsSchema).then(setEvents).catch(setError).finally(() => setLoading(false)) }
  useEffect(load, [shipment.id])
  const requests = events.filter(e => (e.kind === 'quotation_request' || e.kind === 'reroute_request') && !e.decision && !events.some(r => r.request_id === e.id))
  return <>
    <header className="detail-header"><div><span className="eyebrow">Shipment</span><h2>{shortId(shipment.id)}</h2></div><Tag tone={shipment.status}>{shipment.status.replaceAll('_', ' ')}</Tag></header>
    <Facts entries={[
      ['Product', data.name('products', shipment.productId)], ['Quantity', `${shipment.quantity} ${shipment.unit}`],
      ['Origin', data.name('locations', shipment.originId)], ['Destination', data.name('locations', shipment.destinationId)],
      ['Supplier', shipment.supplierId ?? 'Not recorded'], ['Tracking', shipment.trackingNumber ?? 'Not recorded'],
      ['Estimated arrival', date(shipment.estimatedArrival)], ['Availability confirmed until', date(shipment.verifiedUntil)],
      ['Last updated', date(shipment.updatedAt)],
    ]} />
    {shipment.routeRequest ? <button className="text-action" onClick={() => navigate('routes')}>This shipment carries a saved route request. Compare routes.</button> : null}
    <div className="button-row"><ActionForm title="Record milestone" description="Appends a milestone and applies its status atomically. Terminal shipments cannot be reopened." label="Add milestone" path={`/shipments/${shipment.id}/events`} input={shippingEventInputSchema} output={shippingEventSchema} fields={milestoneFields} build={form => ({ kind: 'milestone', title: String(form.get('title')), note: String(form.get('note') ?? ''), source: 'owner', idempotencyKey: crypto.randomUUID(), status: String(form.get('status')), occurredAt: iso(form.get('occurredAt')), ...(form.get('trackingNumber') ? { trackingNumber: String(form.get('trackingNumber')) } : {}), ...(form.get('estimatedArrival') ? { estimatedArrival: iso(form.get('estimatedArrival')) } : {}) })} onSuccess={() => { load(); onChanged() }} />
      <ActionForm title="Add note" description="Appends an attributed owner note. Notes are immutable once written." label="Add note" path={`/shipments/${shipment.id}/events`} input={shippingEventInputSchema} output={shippingEventSchema} fields={eventFields} build={form => ({ kind: 'note', title: String(form.get('title')), note: String(form.get('note') ?? ''), source: 'owner', idempotencyKey: crypto.randomUUID() })} onSuccess={load} />
      <ActionForm title="Request reroute" description="Records a reroute request. A request is not a confirmation; record the partner response separately." label="Request reroute" path={`/shipments/${shipment.id}/events`} input={shippingEventInputSchema} output={shippingEventSchema} fields={eventFields} build={form => ({ kind: 'reroute_request', title: String(form.get('title')), note: String(form.get('note') ?? ''), source: 'owner', idempotencyKey: crypto.randomUUID() })} onSuccess={load} />
      {requests.length ? <ActionForm title="Record partner response" description="Closes one open request. The response must cite a note and can only be recorded once." label="Partner response" path={`/shipments/${shipment.id}/events`} input={shippingEventInputSchema} output={shippingEventSchema} fields={[{ key: 'requestId', label: 'Request', options: requests.map(r => ({ value: r.id, label: `${r.kind.replaceAll('_', ' ')} · ${r.title} · ${shortId(r.id)}` })) }, { key: 'decision', label: 'Decision', options: [{ value: 'confirmed', label: 'Confirmed' }, { value: 'rejected', label: 'Rejected' }] }, { key: 'title', label: 'Title' }, { key: 'note', label: 'Partner evidence and note', type: 'textarea' }]} build={form => ({ kind: 'partner_response', requestId: String(form.get('requestId')), decision: String(form.get('decision')), title: String(form.get('title')), note: String(form.get('note')), source: 'owner', idempotencyKey: crypto.randomUUID() })} onSuccess={load} /> : null}
      {shipment.inventoryId ? <ActionForm title="Confirm replenishment availability" description="Updates the verified availability of this replenishment shipment. A confirmation must include the evidence expiry." label="Confirm availability" path={`/inventory/replenishments/${shipment.id}`} method="PATCH" input={replenishmentWriteSchema} output={replenishmentRecordSchema} fields={[{ key: 'inventoryId', label: 'Stock record', type: 'hidden', value: shipment.inventoryId }, { key: 'quantity', label: 'Quantity', type: 'hidden', value: shipment.quantity }, { key: 'unit', label: 'Unit', type: 'hidden', value: shipment.unit }, { key: 'confirmedQuantity', label: 'Confirmed quantity', value: shipment.confirmedQuantity ?? shipment.quantity }, { key: 'verifiedUntil', label: 'Availability verified until', type: 'datetime-local' }]} build={form => ({ inventoryId: String(form.get('inventoryId')), quantity: String(form.get('quantity')), unit: String(form.get('unit')), confirmedQuantity: String(form.get('confirmedQuantity')), verifiedUntil: iso(form.get('verifiedUntil')), routeRequest: null })} onSuccess={() => { load(); onChanged() }} /> : null}</div>
    <section className="sub-section"><header><h3>Lifecycle audit</h3><span>{events.length} entries</span></header>
      {error ? <ErrorMessage error={error} /> : loading ? <p className="muted">Reading lifecycle events…</p> : events.length === 0 ? <p className="muted">No lifecycle event has been recorded for this shipment.</p> : <ol className="timeline">{events.map(event => <li key={event.id}><div><Tag>{event.kind.replaceAll('_', ' ')}</Tag><b>{event.title}</b></div><p>{event.note || 'No note recorded.'}</p><small>{date(event.occurred_at)} · {event.source.replaceAll('_', ' ')}{event.decision ? ` · ${event.decision}` : ''}</small></li>)}</ol>}
    </section>
    <Evidence title="Route request and availability payloads" value={{ routeRequest: shipment.routeRequest, inventoryId: shipment.inventoryId, confirmedQuantity: shipment.confirmedQuantity }} />
  </>
}
