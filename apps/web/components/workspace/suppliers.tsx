'use client'
import { useState } from 'react'
import { z } from 'zod'
import { supplierSearchResponseSchema } from '@altair/shared/contracts'
import { api } from '@/lib/client/api'
import { useData } from './data'
import { Empty, ErrorMessage, Heading, Panel, Tag, date, shortId } from './common'

type Search = z.infer<typeof supplierSearchResponseSchema>

export function Suppliers() {
  const data = useData()
  const [result, setResult] = useState<Search | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState<unknown>(null)
  return <>
    <Heading title="Suppliers" description="Catalog matching only. Availability is always shown as unverified until attributed evidence is recorded." />
    <Panel title="Search the supplier catalog">
      <form className="form-grid" onSubmit={async event => { event.preventDefault(); if (busy) return; const form = new FormData(event.currentTarget); setBusy(true); setError(null); try { const product = String(form.get('productId') ?? ''), hsCode = String(form.get('hsCode') ?? '').trim(), classification = String(form.get('classification') ?? '').trim(), location = String(form.get('locationId') ?? ''); const result = await api('/suppliers/search', supplierSearchResponseSchema, { method: 'POST', body: { ...(product ? { productId: product } : {}), ...(hsCode ? { hsCode } : {}), ...(classification ? { classification } : {}), ...(location ? { locationId: location } : {}), countryCodes: String(form.get('countryCodes') ?? '').split(',').map(v => v.trim()).filter(Boolean), capabilities: String(form.get('capabilities') ?? '').split(',').map(v => v.trim()).filter(Boolean), limit: 20 } }); setResult(result) } catch (e) { setError(e) } finally { setBusy(false) } }}>
        <label><span>Product (optional)</span><select name="productId"><option value="">Any catalog product</option>{data.products.map(p => <option key={p.id} value={p.id}>{p.name}{p.hsCode ? ` · HS ${p.hsCode}` : ''}</option>)}</select></label>
        <label><span>HS code (optional)</span><input name="hsCode" inputMode="numeric" placeholder="e.g. 84713010" /><small>An HS code requires the classification edition.</small></label>
        <label><span>Classification edition</span><input name="classification" placeholder="e.g. HS 2022" /></label>
        <label><span>Country codes (optional)</span><input name="countryCodes" placeholder="QA, AE, OM" /><small>Comma separated ISO codes or provider labels.</small></label>
        <label><span>Capabilities (optional)</span><input name="capabilities" placeholder="cold chain, hazmat" /></label>
        <label><span>Catalog location (optional)</span><select name="locationId"><option value="">Any location</option>{data.locations.map(l => <option key={l.id} value={l.id}>{l.name} ({l.countryCode})</option>)}</select></label>
        <div className="form-actions wide"><button className="primary-action" type="submit" disabled={busy}>{busy ? 'Matching…' : 'Search suppliers'}</button></div>
      </form>
      <ErrorMessage error={error} />
    </Panel>
    {!result ? <Empty>No search has been run. Results are catalog matches, not purchase commitments.</Empty> : <>
      <div className="panel-heading"><h2>Matches</h2><span className="muted">Evaluated {date(result.evaluatedAt)} · {result.data.length} results</span></div>
      {result.data.length === 0 ? <Empty>No supplier catalog entry matches these criteria. No speculative supplier is generated.</Empty> : <div className="table-scroll"><table><thead><tr><th>Supplier</th><th>Country</th><th>Match</th><th>Score</th><th>Availability</th><th>Reasons</th></tr></thead><tbody>{result.data.map(s => <tr key={s.id}><td>{s.name}<small className="mono">{shortId(s.id)}</small></td><td>{s.countryCode ?? 'Not recorded'}</td><td><Tag>{s.matchStatus.replaceAll('_', ' ')}</Tag></td><td className="mono">{s.score.toFixed(2)}</td><td><Tag tone="warn">unverified</Tag></td><td><ul className="inline-list">{s.reasons.map(r => <li key={r}>{r}</li>)}</ul></td></tr>)}</tbody></table></div>}
      {result.limitations.length ? <div className="notice">{result.limitations.map(l => <p key={l}>{l}</p>)}</div> : null}
      <div className="evidence-grid">{result.data.map(s => <details className="evidence" key={s.id}><summary>{s.name} · evidence</summary>{s.evidence.length === 0 ? <p className="muted">No evidence record.</p> : <ul>{s.evidence.map(e => <li key={e.id}><a href={e.sourceUrl} target="_blank" rel="noreferrer">{e.description}</a><small>{e.status} · observed {date(e.observedAt)} · expires {date(e.expiresAt)}</small></li>)}</ul>}</details>)}</div>
    </>}
  </>
}
