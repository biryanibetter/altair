'use client'
import { useEffect, useMemo, useState } from 'react'
import { readResponseSchema, risksResponseSchema } from '@altair/shared/contracts'
import type { Observation } from '@altair/shared/contracts'
import { api } from '@/lib/client/api'
import { useData } from './data'
import { LogisticsMap } from './map'
import { ErrorMessage, Heading, Panel, Tag, date, shortId } from './common'
import type { PageId } from './shell'

type Risks = { data: { id: string; category: string; severity: string; target: { kind: string; id: string }; evidence: string; status: string; nature: string; observedAt: string }[]; meta: { availability: 'available' | 'unavailable'; evaluatedAt: string; coverage: { rules: string[]; unmappedObservations: number } } }

export function Overview({ navigate }: { navigate: (page: PageId) => void }) {
  const data = useData()
  const [observations, setObservations] = useState<Observation[]>([])
  const [risks, setRisks] = useState<Risks | null>(null)
  const [riskError, setRiskError] = useState<unknown>(null)
  useEffect(() => {
    const controller = new AbortController()
    void api('/observations?limit=100', readResponseSchema, { signal: controller.signal }).then(result => { if (!controller.signal.aborted) setObservations(result.data) }).catch(() => undefined)
    void api('/risks?limit=6&freshness=active', risksResponseSchema, { signal: controller.signal }).then(result => { if (!controller.signal.aborted) setRisks(result) }).catch(error => { if (!controller.signal.aborted) setRiskError(error) })
    return () => controller.abort()
  }, [])
  const delayed = data.shipments.filter(s => s.status === 'delayed')
  const open = data.alerts.filter(a => a.state === 'open')
  const critical = open.filter(a => a.severity === 'critical' || a.severity === 'high')
  const mapped = data.locations.filter(l => l.coordinates)
  const active = data.shipments.filter(s => s.status === 'in_transit' || s.status === 'planned')
  const stats = useMemo(() => [
    ['Active shipments', active.length.toLocaleString()],
    ['In transit', data.shipments.filter(s => s.status === 'in_transit').length.toLocaleString()],
    ['Exceptions', delayed.length.toLocaleString()],
    ['Open alerts', open.length.toLocaleString()],
  ], [active.length, data.shipments, delayed.length, open.length])
  return <>
    <Heading title="Operations overview" description="Owned shipments, catalog geography and attributed observations. Nothing on this map is inferred beyond the source shown.">
      <button className="text-action" onClick={() => navigate('shipments')}>Open shipments</button>
    </Heading>
    <div className="metrics">{stats.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
    <div className="overview-grid">
      <LogisticsMap locations={mapped} observations={observations} />
      <aside className="overview-inspector">
        <header><span>Network snapshot</span><Tag>{data.loading ? 'Loading' : 'Current'}</Tag></header>
        <div className="inspector-block"><span className="eyebrow">Catalog geography</span><b>{mapped.length} mapped locations</b><small>Markers are catalog hubs, not live shipment positions.</small></div>
        <div className="inspector-block"><span className="eyebrow">Observed traffic</span><b>{observations.length} attributed positions</b><small>Latest observation per provider asset. Stale positions are dimmed.</small></div>
        <div className="inspector-block"><span className="eyebrow">Work queue</span><b>{critical.length} high-severity alerts</b><small>Opened by the monitoring engine. Severity and evidence are preserved.</small></div>
        <button className="text-action" onClick={() => navigate('alerts')}>Review alerts</button>
      </aside>
    </div>
    <div className="lower-strip">
      <Panel title="Exceptions" action={<button className="text-action" onClick={() => navigate('shipments')}>All shipments</button>}>
        {delayed.length === 0 ? <p className="muted">No shipment is currently marked delayed.</p> : <ul className="compact-list">{delayed.slice(0, 5).map(s => <li key={s.id}><span className="mono">{shortId(s.id)}</span><span>{data.name('products', s.productId)}</span><Tag tone="warn">delayed</Tag><small>ETA {date(s.estimatedArrival)}</small></li>)}</ul>}
      </Panel>
      <Panel title="Open alerts" action={<button className="text-action" onClick={() => navigate('alerts')}>Alert inbox</button>}>
        {open.length === 0 ? <p className="muted">No open alerts. The monitoring engine may still be unavailable.</p> : <ul className="compact-list">{open.slice(0, 5).map(a => <li key={a.id}><Tag tone={a.severity}>{a.severity}</Tag><span>{a.title}</span><small>{a.rule?.replaceAll('_', ' ') ?? 'manual'}</small></li>)}</ul>}
      </Panel>
      <Panel title="Intelligence" action={<button className="text-action" onClick={() => navigate('crisis')}>Risk register</button>}>
        {riskError ? <ErrorMessage error={riskError} /> : !risks ? <p className="muted">Reading risk signals…</p> : risks.meta.availability === 'unavailable' ? <p className="muted">No active, attributed risk signal is available. The register does not substitute demonstration data.</p> : <ul className="compact-list">{risks.data.slice(0, 5).map(r => <li key={r.id}><Tag tone={r.severity}>{r.severity}</Tag><span>{r.category} · {r.target.kind}</span><small>{r.evidence}</small></li>)}</ul>}
      </Panel>
    </div>
  </>
}
