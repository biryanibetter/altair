'use client'
import { useCallback, useEffect, useState } from 'react'
import { z } from 'zod'
import { freshnessResponseSchema, importDependencyResponseSchema, readResponseSchema, risksResponseSchema, scenarioRecordSchema, simulationOutputSchema, statusResponseSchema } from '@altair/shared/contracts'
import type { Observation } from '@altair/shared/contracts'
import { api } from '@/lib/client/api'
import { useData } from './data'
import { Empty, ErrorMessage, Evidence, Facts, Heading, Panel, Tag, date, shortId } from './common'

const listSchema = z.object({ data: z.array(z.object({ id: z.uuid(), name: z.string(), createdAt: z.iso.datetime(), engineVersion: z.string(), executed: z.boolean() })), meta: z.object({ nextCursor: z.uuid().nullable() }) })
type Scenario = z.infer<typeof scenarioRecordSchema>
type Output = z.infer<typeof simulationOutputSchema>
type Tab = 'simulations' | 'risks' | 'readiness' | 'dependencies' | 'twin'

export function Crisis() {
  const [tab, setTab] = useState<Tab>('simulations')
  return <>
    <Heading title="Crisis command" description="Simulation, resilience and compliance share one command surface. Every output keeps its engine version, snapshot hash and limitations." />
    <div className="tabs" role="tablist">{([['simulations', 'Simulations'], ['risks', 'Risk register'], ['readiness', 'Data readiness'], ['dependencies', 'Dependencies & compliance'], ['twin', 'Digital twin']] as const).map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>)}</div>
    {tab === 'simulations' ? <Simulations /> : tab === 'risks' ? <Risks /> : tab === 'readiness' ? <Readiness /> : tab === 'dependencies' ? <Dependencies /> : <Simulations initial="twin" />}
  </>
}

function Simulations({ initial }: { initial?: 'twin' }) {
  const data = useData()
  const [items, setItems] = useState<z.infer<typeof listSchema>['data']>([]), [selected, setSelected] = useState<Scenario | null>(null), [output, setOutput] = useState<Output | null>(null), [error, setError] = useState<unknown>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState('')
  const loadList = () => api('/scenarios', listSchema).then(result => setItems(result.data)).catch(setError)
  useEffect(() => { void loadList() }, [])
  useEffect(() => { if (!selected && items.length) void open(items[0].id) }, [items, selected])
  const open = async (id: string) => { setBusy(true); setError(null); try { const record = await api(`/scenarios/${id}`, scenarioRecordSchema); setSelected(record); setOutput(record.output ?? null) } catch (e) { setError(e) } finally { setBusy(false) } }
  const execute = async () => { if (!selected) return; setBusy(true); setError(null); try { const result = await api(`/scenarios/${selected.id}/execute`, simulationOutputSchema, { method: 'POST' }); setOutput(result); setSelected({ ...selected, output: result }); await loadList(); setMessage('Scenario executed and sealed. Re-execution is integrity-checked against the saved output.') } catch (e) { setError(e) } finally { setBusy(false) } }
  const inventoryOptions = data.inventory.map(i => ({ value: i.id, label: `${shortId(i.id)} · ${data.name('products', i.productId)}` }))
  const supplierOptions = data.shipments.filter(s => s.supplierId).map(s => ({ value: s.supplierId!, label: `${data.name('locations', s.originId)} supply · ${shortId(s.supplierId!)}` }))
  const locationOptions = data.locations.filter(l => l.coordinates).map(l => ({ value: l.id, label: `${l.name} (${l.countryCode})` }))
  if (initial === 'twin') return <>
    <Panel title="Digital twin" action={<button className="text-action" disabled={busy || !selected} onClick={execute}>{busy ? 'Executing…' : 'Execute scenario'}</button>}>
      {!selected ? <Empty>Select a scenario to inspect its twin output.</Empty> : <TwinView selected={selected} output={output} error={error} />}
    </Panel>
    <Panel title="Saved scenarios"><ScenarioList items={items} selected={selected} onSelect={open} /></Panel>
  </>
  return <>
    <div className="split-workspace">
      <section className="region">
        <header className="table-tools"><h2>Scenario library</h2><span className="muted">{items.length} saved</span></header>
        <ScenarioList items={items} selected={selected} onSelect={open} />
      </section>
      <aside className="detail-region">
        <Panel title="Create scenario">
          <form className="form-grid" onSubmit={async event => { event.preventDefault(); if (busy) return; const form = new FormData(event.currentTarget); const kind = String(form.get('kind')), target = String(form.get('targetId') ?? ''), unit = String(form.get('unit') ?? ''), quantity = String(form.get('quantity') ?? ''), delayHours = Number(form.get('delayHours') ?? 0); const modifications = kind === 'supplier_unavailable' ? [{ kind, supplierId: target }] : kind === 'inventory_reduction' ? [{ kind, inventoryId: target, quantity }] : kind === 'replenishment_delay' ? [{ kind, shipmentId: target, delayHours }] : kind === 'demand_increase' ? [{ kind, productId: target, unit, quantity }] : []; setBusy(true); setError(null); try { const record = await api('/scenarios', scenarioRecordSchema, { method: 'POST', body: { name: String(form.get('name')), routeRequest: { originId: String(form.get('originId')), destinationId: String(form.get('destinationId')) }, horizonHours: Number(form.get('horizonHours')), hypothetical: false, assumptions: [], demand: [], replenishments: [], modifications } }); setSelected(record); setOutput(null); await loadList(); setMessage('Scenario created from the current server snapshot.') } catch (e) { setError(e) } finally { setBusy(false) } }}>
            <label><span>Scenario name</span><input name="name" required /></label>
            <label><span>Origin</span><select name="originId" required>{locationOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
            <label><span>Destination</span><select name="destinationId" required>{locationOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
            <label><span>Horizon (hours)</span><input name="horizonHours" type="number" min={1} max={8760} defaultValue={168} required /></label>
            <label><span>Modification</span><select name="kind" defaultValue="none"><option value="none">None (baseline replay)</option><option value="supplier_unavailable">Supplier unavailable</option><option value="inventory_reduction">Inventory reduction</option><option value="replenishment_delay">Replenishment delay</option><option value="demand_increase">Demand increase</option></select></label>
            <label><span>Target id</span><input name="targetId" placeholder="Supplier, stock, shipment or product UUID" /></label>
            <label><span>Quantity</span><input name="quantity" inputMode="decimal" placeholder="Required for stock or demand" /></label>
            <label><span>Unit</span><input name="unit" placeholder="Required for demand" /></label>
            <label><span>Delay hours</span><input name="delayHours" type="number" min={1} max={8760} step="any" /></label>
            <div className="form-actions wide"><button className="primary-action" type="submit" disabled={busy || locationOptions.length < 2}>{busy ? 'Creating…' : 'Create scenario'}</button></div>
          </form>
          <p className="muted small">Available targets: {inventoryOptions.length} stock records, {supplierOptions.length} observed suppliers, {data.shipments.length} shipments, {data.products.length} products.</p>
        </Panel>
      </aside>
    </div>
    <ErrorMessage error={error} />
    {message ? <p role="status">{message}</p> : null}
    <Panel title="Twin comparison" action={selected ? <button className="text-action" disabled={busy} onClick={execute}>{busy ? 'Executing…' : output ? 'Verify execution' : 'Execute scenario'}</button> : undefined}>
      {!selected ? <Empty>Select a scenario to compare baseline and simulated conditions.</Empty> : <TwinView selected={selected} output={output} error={error} />}
    </Panel>
  </>
}

function ScenarioList({ items, selected, onSelect }: { items: z.infer<typeof listSchema>['data']; selected: Scenario | null; onSelect: (id: string) => void }) {
  if (items.length === 0) return <Empty>No scenario has been created for this account.</Empty>
  return <div className="table-scroll"><table><thead><tr><th>Scenario</th><th>Created</th><th>Engine</th><th>Executed</th></tr></thead><tbody>{items.map(s => <tr key={s.id} className={s.id === selected?.id ? 'selected' : ''} onClick={() => onSelect(s.id)}><td>{s.name}<small className="mono">{shortId(s.id)}</small></td><td>{date(s.createdAt)}</td><td className="mono">{s.engineVersion}</td><td>{s.executed ? <Tag>sealed</Tag> : <Tag tone="warn">not executed</Tag>}</td></tr>)}</tbody></table></div>
}

function TwinView({ selected, output, error }: { selected: Scenario; output: Output | null; error: unknown }) {
  return <>
    <header className="detail-header"><div><span className="eyebrow">Scenario</span><h2>{selected.name}</h2></div><Tag>{selected.engineVersion}</Tag></header>
    <Facts entries={[['Created', date(selected.createdAt)], ['Baseline reference', selected.baselineReference], ['Snapshot nodes', selected.snapshot.network.nodes.length], ['Snapshot edges', selected.snapshot.network.edges.length], ['Snapshot risks', selected.snapshot.risks.length], ['Hypothetical', selected.input.hypothetical ? 'Yes' : 'No'], ['Horizon', `${selected.input.horizonHours} hours`]]} />
    <ErrorMessage error={error} />
    {!output ? <p className="muted">This scenario has not been executed. Execution is deterministic for the saved snapshot and engine version.</p> : <>
      <div className="metrics"><div><span>Baseline routes</span><strong>{output.baseline.routes.alternatives.length}</strong></div><div><span>Simulated routes</span><strong>{output.simulated.routes.alternatives.length}</strong></div><div><span>Lost routes</span><strong>{output.routeChanges.lostRouteIds.length}</strong></div><div><span>Gained routes</span><strong>{output.routeChanges.gainedRouteIds.length}</strong></div></div>
      <Facts entries={[['Nature', output.nature], ['Evaluated', date(output.evaluatedAt)], ['Snapshot hash', output.snapshotHash], ['Preferred cost delta', output.routeChanges.preferredCostDelta ? `${output.routeChanges.preferredCostDelta.amount} ${output.routeChanges.preferredCostDelta.currency}` : 'Unavailable'], ['Preferred duration delta', output.routeChanges.preferredDurationDeltaHours == null ? 'Unavailable' : `${output.routeChanges.preferredDurationDeltaHours} h`], ['Conditional routes', output.routeChanges.conditionalRouteIds.length]]} />
      <div className="table-scroll"><table><thead><tr><th>Supply target</th><th>Baseline shortage</th><th>Simulated shortage</th><th>Complete</th></tr></thead><tbody>{output.simulated.supply.map((row, index) => <tr key={`${row.productId}-${index}`}><td className="mono">{shortId(row.productId)}</td><td>{output.baseline.supply[index]?.shortage ?? 'Unavailable'}</td><td>{row.shortage ?? 'Unavailable'}</td><td>{row.complete ? 'Yes' : 'No'}</td></tr>)}</tbody></table></div>
      {output.routeChanges.reasons.length ? <ul className="compact-list">{output.routeChanges.reasons.map(r => <li key={r}>{r}</li>)}</ul> : null}
      <Evidence title="Simulation changes, assumptions and hashes" value={{ changes: output.changes, assumptions: output.assumptions, inputHash: output.inputHash, engineVersion: output.engineVersion, routingEngineVersion: output.routingEngineVersion }} />
    </>}
  </>
}

function Risks() {
  const [category, setCategory] = useState(''), [freshness, setFreshness] = useState('active'), [result, setResult] = useState<z.infer<typeof risksResponseSchema> | null>(null), [error, setError] = useState<unknown>(null), [busy, setBusy] = useState(false)
  const load = useCallback(async () => { setBusy(true); setError(null); try { setResult(await api(`/risks?limit=100&freshness=${freshness}${category ? `&category=${category}` : ''}`, risksResponseSchema)) } catch (e) { setError(e) } finally { setBusy(false) } }, [category, freshness])
  useEffect(() => { void load() }, [load])
  return <>
    <Panel title="Risk register" action={<div className="inline-controls"><select aria-label="Risk category" value={category} onChange={e => setCategory(e.target.value)}><option value="">All categories</option><option value="weather">Weather</option><option value="transportation">Transportation</option><option value="supplier">Supplier</option><option value="geopolitical">Geopolitical</option></select><select aria-label="Freshness" value={freshness} onChange={e => setFreshness(e.target.value)}><option value="active">Active</option><option value="stale">Stale</option><option value="all">All</option></select></div>}>
      <ErrorMessage error={error} />
      {busy ? <p className="muted">Evaluating risk signals…</p> : !result ? <Empty>No risk evaluation has completed.</Empty> : result.meta.availability === 'unavailable' ? <Empty>No attributed risk signal matches this view. The register does not invent signals.</Empty> : <div className="table-scroll"><table><thead><tr><th>Severity</th><th>Category</th><th>Target</th><th>Status</th><th>Nature</th><th>Observed</th><th>Evidence</th></tr></thead><tbody>{result.data.map(r => <tr key={r.id}><td><Tag tone={r.severity}>{r.severity}</Tag></td><td>{r.category}</td><td className="mono">{r.target.kind} {shortId(r.target.id)}</td><td>{r.status}</td><td>{r.nature}</td><td>{date(r.observedAt)}</td><td>{r.evidence}<small>{r.rule} · expires {date(r.validUntil)}</small></td></tr>)}</tbody></table></div>}
      {result ? <Facts entries={[['Evaluated', date(result.meta.evaluatedAt)], ['Unmapped observations', result.meta.coverage.unmappedObservations], ['Legacy signals', result.meta.coverage.legacySignals], ['Rules', result.meta.coverage.rules.join(', ') || 'None']]} /> : null}
    </Panel>
    <p className="muted small">Geopolitical entries are potential evidence only. Confirmed status is not asserted for news-derived signals.</p>
  </>
}

function Readiness() {
  const [status, setStatus] = useState<z.infer<typeof statusResponseSchema> | null>(null), [freshness, setFreshness] = useState<z.infer<typeof freshnessResponseSchema> | null>(null), [health, setHealth] = useState<{ status: string; database: string } | null>(null), [error, setError] = useState<unknown>(null)
  useEffect(() => {
    const controller = new AbortController()
    void api('/ingestion/status', statusResponseSchema, { signal: controller.signal }).then(setStatus).catch(setError)
    void api('/freshness', freshnessResponseSchema, { signal: controller.signal }).then(setFreshness).catch(setError)
    void fetch('/api/v1/health', { cache: 'no-store' }).then(async r => setHealth(await r.json())).catch(() => undefined)
    return () => controller.abort()
  }, [])
  return <>
    <ErrorMessage error={error} />
    <div className="lower-strip"><Panel title="Database"><Facts entries={[['Health', health ? health.status : 'Checking'], ['Database', health ? health.database : 'Checking']]} /><p className="muted small">A disconnected database blocks owned records and authentication-backed writes.</p></Panel>
      <Panel title="Freshness"><Facts entries={[['Providers tracked', freshness?.data.length ?? '—'], ['Fresh', freshness?.data.filter(f => f.status === 'fresh').length ?? '—'], ['Stale', freshness?.data.filter(f => f.status === 'stale').length ?? '—'], ['Unavailable', freshness?.data.filter(f => f.status === 'unavailable').length ?? '—']]} /></Panel>
      <Panel title="Compliance boundary"><p className="muted">No customs filing, booking or legal determination is performed by this workspace. Provider terms and attribution are preserved with each observation.</p></Panel></div>
    <Panel title="Ingestion status">{!status ? <p className="muted">Reading provider status…</p> : <div className="table-scroll"><table><thead><tr><th>Job</th><th>Status</th><th>Nature</th><th>Coverage</th><th>Last success</th><th>Last attempt</th><th>Error</th></tr></thead><tbody>{status.data.map(s => <tr key={s.job}><td>{s.job}</td><td><Tag tone={s.status === 'success' ? '' : 'warn'}>{s.status}</Tag></td><td>{s.nature}</td><td>{s.coverage}</td><td>{date(s.lastSuccessAt)}</td><td>{date(s.lastAttemptAt)}</td><td className="mono">{s.errorCode ?? '—'}</td></tr>)}</tbody></table></div>}</Panel>
    <Panel title="Observation freshness">{!freshness ? <p className="muted">Reading freshness…</p> : <div className="table-scroll"><table><thead><tr><th>Job</th><th>Status</th><th>Nature</th><th>Last success</th><th>Expires</th></tr></thead><tbody>{freshness.data.map(f => <tr key={f.job}><td>{f.job}</td><td>{f.status}</td><td>{f.nature}</td><td>{date(f.lastSuccessAt)}</td><td>{date(f.expiresAt)}</td></tr>)}</tbody></table></div>}</Panel>
  </>
}

function observationSummary(observation: Observation) {
  const d = observation.data
  if (d.kind === 'trade') return `${d.reporter}${d.partner ? ` · ${d.partner}` : ''} · HS ${d.hsCode} · ${d.flow} · ${d.value} ${d.currency}`
  if (d.kind === 'dependency') return `${d.reporter} · ${d.partner} · ${d.sharePercent.toFixed(1)}% share`
  if (d.kind === 'classification') return `HS ${d.hsCode} · ${d.description}`
  return d.kind
}

function Dependencies() {
  const [result, setResult] = useState<z.infer<typeof importDependencyResponseSchema> | null>(null), [trade, setTrade] = useState<Observation[]>([]), [error, setError] = useState<unknown>(null), [busy, setBusy] = useState(false)
  useEffect(() => { const controller = new AbortController(); void api('/trade?limit=50', readResponseSchema, { signal: controller.signal }).then(response => { if (!controller.signal.aborted) setTrade(response.data) }).catch(e => { if (!controller.signal.aborted) setError(e) }); return () => controller.abort() }, [])
  return <>
    <Panel title="Import dependency assessment">
      <form className="form-grid" onSubmit={async event => { event.preventDefault(); if (busy) return; const form = new FormData(event.currentTarget); setBusy(true); setError(null); try { const provider = String(form.get('provider') ?? ''); const mappings = String(form.get('mappings') ?? '').split(',').map(pair => pair.trim()).filter(Boolean).map(pair => { const [origin, countryCode] = pair.split(':').map(value => value?.trim() ?? ''); return { origin, countryCode } }); const response = await api('/import-dependencies', importDependencyResponseSchema, { method: 'POST', body: { reporter: String(form.get('reporter')), hsCode: String(form.get('hsCode')), classification: String(form.get('classification')), currency: String(form.get('currency')), ...(provider ? { provider } : {}), affectedOrigins: String(form.get('affectedOrigins') ?? '').split(',').map(v => v.trim()).filter(Boolean), originCountryMappings: mappings } }); setResult(response) } catch (e) { setError(e) } finally { setBusy(false) } }}>
        <label><span>Reporter</span><input name="reporter" placeholder="e.g. Qatar" required /></label>
        <label><span>HS code</span><input name="hsCode" inputMode="numeric" placeholder="e.g. 84713010" required /></label>
        <label><span>Classification edition</span><input name="classification" placeholder="e.g. HS 2022" required /></label>
        <label><span>Currency</span><select name="currency" defaultValue="QAR"><option>QAR</option><option>USD</option></select></label>
        <label><span>Provider (optional)</span><select name="provider"><option value="">Any configured source</option><option value="qatar-open-data">Qatar open data</option><option value="un-comtrade">UN Comtrade</option></select></label>
        <label><span>Affected origins (optional)</span><input name="affectedOrigins" placeholder="China, India, Germany" /></label>
        <label className="wide"><span>Origin → country mappings</span><input name="mappings" placeholder="China:CN, India:IN" /><small>Required to evaluate exposure and concentration for each origin.</small></label>
        <div className="form-actions wide"><button className="primary-action" type="submit" disabled={busy}>{busy ? 'Assessing…' : 'Assess dependency'}</button></div>
      </form>
      <ErrorMessage error={error} />
      {result ? <>
        <div className="table-scroll"><table><thead><tr><th>Period</th><th>Total value</th><th>Top origin share</th><th>HHI</th><th>Exposed share</th><th>Change</th></tr></thead><tbody>{result.periods.map(period => <tr key={period.period}><td>{period.period}</td><td>{period.totalValue}</td><td>{period.topOriginShare == null ? 'Unavailable' : period.topOriginShare.toFixed(2)}</td><td>{period.hhi == null ? 'Unavailable' : period.hhi.toFixed(3)}</td><td>{period.exposedShare == null ? 'Unavailable' : period.exposedShare.toFixed(2)}</td><td>{period.changePercent == null ? 'Unavailable' : `${period.changePercent.toFixed(1)}%`}</td></tr>)}</tbody></table></div>
        {result.periods.length === 0 ? <Empty>No trade period returned for this query.</Empty> : null}
        {result.limitations.length ? <div className="notice">{result.limitations.map(l => <p key={l}>{l}</p>)}</div> : null}
        <Evidence title="Period origin breakdown and source observations" value={{ periods: result.periods, sourceObservations: result.sourceObservations?.slice(0, 25) }} />
        <p className="muted small">This is trade evidence and concentration analysis, not a customs ruling, duty calculation or legal determination.</p>
      </> : <p className="muted">No dependency assessment has been requested. The engine will not estimate missing trade data.</p>}
    </Panel>
    <Panel title="Trade and dependency observations">
      {trade.length === 0 ? <Empty>No attributed trade observation is available for this account or provider set.</Empty> : <div className="table-scroll"><table><thead><tr><th>Provider</th><th>Kind</th><th>Observation</th><th>Nature</th><th>Observed</th><th>Source</th></tr></thead><tbody>{trade.map(observation => <tr key={observation.id}><td>{observation.provider}</td><td>{observation.data.kind}</td><td>{observationSummary(observation)}</td><td>{observation.nature}</td><td>{date(observation.observedAt)}</td><td>{observation.sourceUrl ? <a href={observation.sourceUrl} target="_blank" rel="noreferrer">source</a> : 'Not recorded'}<small>{observation.license}</small></td></tr>)}</tbody></table></div>}
    </Panel>
  </>
}
