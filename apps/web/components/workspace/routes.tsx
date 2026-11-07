'use client'
import { useState } from 'react'
import { z } from 'zod'
import { routeComparisonSchema, shippingEventInputSchema, shippingEventSchema } from '@altair/shared/contracts'
import { api } from '@/lib/client/api'
import { useData } from './data'
import { LogisticsMap } from './map'
import { ActionForm, Empty, ErrorMessage, Evidence, Facts, Heading, Panel, Tag, shortId } from './common'

type Comparison = z.infer<typeof routeComparisonSchema>
type Alternative = Comparison['alternatives'][number]

export function RoutePlanning() {
  const data = useData()
  const [comparison, setComparison] = useState<Comparison | null>(null), [selected, setSelected] = useState<Alternative | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState<unknown>(null)
  const locations = data.locations.filter(l => l.coordinates)
  const alternative = selected ?? comparison?.alternatives[0] ?? null
  if (data.locations.filter(l => l.coordinates).length < 2) return <><Heading title="Route planning" description="Compare feasible, attributed alternatives across the catalog network." /><Empty>At least two catalog locations with coordinates are required. Add locations with coordinates before comparing routes.</Empty></>
  return <>
    <Heading title="Route planning" description="Server-side network search with explicit provenance, cost completeness and coverage. Returned geometry is drawn as returned; gaps stay visible." />
    <Panel title="Compare routes" action={<span className="muted">POST /routes/compare</span>}>
      <form className="form-grid" onSubmit={async event => { event.preventDefault(); if (busy) return; const form = new FormData(event.currentTarget); const amount = String(form.get('maxCost') ?? '').trim(); setBusy(true); setError(null); try { const modes = String(form.get('modes')).split(',') as ('land' | 'sea' | 'air')[]; const result = await api('/routes/compare', routeComparisonSchema, { method: 'POST', body: { originId: String(form.get('originId')), destinationId: String(form.get('destinationId')), shipment: { handling: [] }, preferences: { modes, allowHypothetical: false, enrichGeometry: false }, constraints: { ...(form.get('maxDurationHours') ? { maxDurationHours: Number(form.get('maxDurationHours')) } : {}), ...(amount ? { maxCost: { amount, currency: String(form.get('currency')) } } : {}), maxHops: Number(form.get('maxHops')), maxExpansions: 5000, maxAlternatives: 10, requireConfirmed: false, minConfidence: 0, excludedNodeIds: [], excludedEdgeIds: [] }, priorities: { cost: Number(form.get('cost')), time: Number(form.get('time')), risk: Number(form.get('risk')) } } }); setComparison(result); setSelected(result.alternatives[0] ?? null) } catch (e) { setError(e) } finally { setBusy(false) } }}>
        <label><span>Origin</span><select name="originId" required>{locations.map(l => <option key={l.id} value={l.id}>{l.name} ({l.countryCode})</option>)}</select></label>
        <label><span>Destination</span><select name="destinationId" defaultValue={locations[1]?.id} required>{locations.map(l => <option key={l.id} value={l.id}>{l.name} ({l.countryCode})</option>)}</select></label>
        <label><span>Modes</span><select name="modes" defaultValue="land,sea,air"><option value="land,sea,air">Land, sea and air</option><option value="land">Land only</option><option value="sea">Sea only</option><option value="air">Air only</option></select></label>
        <label><span>Max hops</span><input name="maxHops" type="number" min={1} max={10} defaultValue={6} required /></label>
        <label><span>Max duration (hours, optional)</span><input name="maxDurationHours" type="number" min={1} step="any" /></label>
        <label><span>Max cost (optional)</span><input name="maxCost" inputMode="decimal" placeholder="12500.00" /></label>
        <label><span>Currency</span><select name="currency" defaultValue="USD"><option>USD</option><option>QAR</option><option>EUR</option></select></label>
        <label><span>Cost weight</span><input name="cost" type="number" min={0} step="any" defaultValue={1} required /></label>
        <label><span>Time weight</span><input name="time" type="number" min={0} step="any" defaultValue={1} required /></label>
        <label><span>Risk weight</span><input name="risk" type="number" min={0} step="any" defaultValue={1} required /></label>
        <div className="form-actions wide"><button className="primary-action" type="submit" disabled={busy}>{busy ? 'Comparing…' : 'Compare routes'}</button><ErrorMessage error={error} /></div>
      </form>
    </Panel>
    {!comparison ? <Empty>No comparison has been requested. Results are never fabricated: unconfigured providers and missing geometry are reported as such.</Empty> : <>
      <div className="overview-grid route-grid"><LogisticsMap locations={[...locations, ...(alternative?.nodes ?? []).filter(n => !locations.some(l => l.id === n.id))]} route={alternative} />
        <aside className="overview-inspector">
          <header><span>{alternative ? `Alternative ${comparison.alternatives.indexOf(alternative) + 1} of ${comparison.alternatives.length}` : 'No feasible alternative'}</span><Tag>{comparison.engineVersion}</Tag></header>
          {alternative ? <><Facts entries={[
            ['Modes', alternative.modes.join(' · ')], ['Duration', alternative.durationHours ? `${alternative.durationHours.min}–${alternative.durationHours.max} h` : 'Unknown'],
            ['Cost', alternative.cost.total ? `${alternative.cost.total.amount} ${alternative.cost.total.currency}${alternative.cost.complete ? '' : ' (incomplete)'}` : 'Unavailable'],
            ['Distance', alternative.distanceKm == null ? 'Unknown' : `${alternative.distanceKm.toFixed(0)} km`], ['Risk', alternative.risk == null ? 'Unknown' : alternative.risk.toFixed(2)],
            ['Confidence', alternative.confidence.toFixed(2)], ['Feasibility', alternative.feasibility], ['Score', alternative.score.toFixed(2)],
            ['Geometry gaps', `${alternative.geometryGaps.length} edges without geometry`], ['Hypothetical', alternative.hypothetical ? 'Yes — simulated legs' : 'No'],
          ]} /><details className="evidence"><summary>Ranking and feasibility reasons</summary><ul>{alternative.rankingReasons.map(r => <li key={r}>{r}</li>)}{alternative.reasons.map(r => <li key={r}>{r}</li>)}</ul></details>
            {data.shipments.length ? <ActionForm title="Save route to shipment" description="Appends an immutable route_saved event containing the returned alternative. It does not book freight or change the shipment status." label="Save to shipment" path={form => `/shipments/${String(form.get('shipmentId'))}/events`} input={shippingEventInputSchema} output={shippingEventSchema} fields={[{ key: 'shipmentId', label: 'Shipment', options: data.shipments.map(s => ({ value: s.id, label: `${shortId(s.id)} · ${s.status.replaceAll('_', ' ')}` })) }, { key: 'title', label: 'Title', value: 'Route alternative saved' }, { key: 'note', label: 'Note', type: 'textarea', required: false }]} build={form => ({ kind: 'route_saved', title: String(form.get('title')), note: String(form.get('note') ?? ''), source: 'owner', idempotencyKey: crypto.randomUUID(), payload: { alternative } })} onSuccess={() => data.refresh()} /> : <p className="muted">Create a shipment before saving an alternative.</p>}
            <p className="muted small">The request is sent to the audit trail of the selected shipment.</p></> : <p className="muted">No alternative satisfies the supplied constraints. Review rejected routes below.</p>}
        </aside>
      </div>
      <Panel title="Alternatives">
        {comparison.alternatives.length === 0 ? <Empty>No feasible alternative was returned.</Empty> : <div className="table-scroll"><table><thead><tr><th>#</th><th>Modes</th><th>Duration</th><th>Cost</th><th>Risk</th><th>Confidence</th><th>Feasibility</th><th>Score</th></tr></thead><tbody>{comparison.alternatives.map((a, index) => <tr key={a.id} className={a === alternative ? 'selected' : ''} onClick={() => setSelected(a)}><td className="mono">{index + 1}</td><td>{a.modes.join(' · ')}</td><td>{a.durationHours ? `${a.durationHours.min}–${a.durationHours.max} h` : 'Unknown'}</td><td>{a.cost.total ? `${a.cost.total.amount} ${a.cost.total.currency}` : 'Unavailable'}</td><td>{a.risk == null ? 'Unknown' : a.risk.toFixed(2)}</td><td>{a.confidence.toFixed(2)}</td><td>{a.feasibility}</td><td className="mono">{a.score.toFixed(2)}</td></tr>)}</tbody></table></div>}
      </Panel>
      <div className="lower-strip">
        <Panel title="Coverage"><Facts entries={[['Expansions', comparison.coverage.expansions], ['Candidates evaluated', comparison.coverage.evaluatedCandidates], ['Truncated', comparison.coverage.truncated ? 'Yes — coverage limited' : 'No'], ['Pareto scope', 'Evaluated candidates only']]} /></Panel>
        <Panel title="Rejected">{comparison.rejectedRoutes.length === 0 ? <p className="muted">No rejected route was recorded.</p> : <ul className="compact-list">{comparison.rejectedRoutes.slice(0, 6).map(r => <li key={r.edgeIds.join()}>{r.reasons.join('; ')}</li>)}</ul>}</Panel>
        <Panel title="Assumptions">{comparison.assumptions.length === 0 ? <p className="muted">No additional assumption was returned.</p> : <ul className="compact-list">{comparison.assumptions.map(a => <li key={a}>{a}</li>)}</ul>}</Panel>
      </div>
      <Evidence title="Provider reasons and full comparison" value={{ reasons: comparison.reasons, rejected: comparison.rejected, evaluatedAt: comparison.evaluatedAt }} />
    </>}
  </>
}
