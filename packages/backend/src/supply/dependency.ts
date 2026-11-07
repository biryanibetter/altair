import { importDependencyRequestSchema, importDependencyResponseSchema, type Observation } from '@altair/shared/contracts'
import type { z } from 'zod'
export function importDependency(data: Observation['data'][], raw: z.input<typeof importDependencyRequestSchema>, affected: string[] = []) {
  const q = importDependencyRequestSchema.parse(raw)
  const digits = Math.max(6, ...data.filter(d => d.kind === 'trade').map(d => d.kind === 'trade' ? (d.value.split('.')[1]?.length ?? 0) : 0))
  if (digits > 400) throw Error('trade_precision_exceeds_ingestion_contract')
  const scale = BigInt(10) ** BigInt(digits)
  const units = (v: string) => { const [whole, fraction = ''] = v.split('.'); return BigInt(whole!) * scale + BigInt(fraction.padEnd(digits, '0')) }
  const fixed = (n: bigint) => `${n / scale}.${(n % scale).toString().padStart(digits, '0')}`
  const ratio = (a: bigint, b: bigint) => Number(a * BigInt(1e12) / b) / 1e12
  const periods = new Map<string, Map<string, bigint>>()
  const affectedOrigins = [...new Set([...q.affectedOrigins, ...affected, ...q.originCountryMappings.filter(m => affected.includes(m.countryCode)).map(m => m.origin)])]
  const limitations = ['observed_origins_not_comprehensive_imports', 'hhi_is_value_share_concentration_not_disruption_probability', 'native_country_identifiers_require_explicit_mapping', 'no_currency_hs_edition_or_monthly_annual_aggregation', 'trade_value_is_not_inventory_or_supplier_capacity', 'period_changes_are_not_seasonally_adjusted']
  if (q.originCountryMappings.length) limitations.push('country_mapping_is_explicit_caller_assumption_not_verified_reference')
  if (affected.some(code => !q.originCountryMappings.some(m => m.countryCode === code) && !data.some(d => d.kind === 'trade' && d.partner === code))) limitations.push('affected_countries_without_native_origin_mapping_excluded_from_exposure')
  for (const row of data) {
    if (row.kind !== 'trade' || row.flow !== 'import' || row.reporter !== q.reporter || row.hsCode !== q.hsCode || row.classification !== q.classification || row.currency !== q.currency) continue
    if (!periods.has(row.period)) periods.set(row.period, new Map())
    if (!row.partner || /^(world|total|all|0)$/i.test(row.partner)) { limitations.push('aggregate_or_unknown_partner_excluded'); continue }
    const origins = periods.get(row.period)!
    origins.set(row.partner, (origins.get(row.partner) ?? BigInt(0)) + units(row.value))
  }
  const all = [...periods].sort(([a], [b]) => a.localeCompare(b)).map(([period, rows]) => {
    const total = [...rows.values()].reduce((a, b) => a + b, BigInt(0))
    const origins = [...rows].sort(([a], [b]) => a.localeCompare(b)).map(([origin, value]) => ({ origin, value: fixed(value), share: total > BigInt(0) ? ratio(value, total) : 0 }))
    const hhi = total > BigInt(0) ? origins.reduce((a, b) => a + b.share ** 2, 0) : null
    return { period, totalValue: fixed(total), origins, hhi, effectiveOrigins: hhi === null ? null : 1 / hhi, topOriginShare: hhi === null ? null : Math.max(...origins.map(o => o.share)), exposedShare: hhi === null ? null : origins.filter(o => affectedOrigins.includes(o.origin)).reduce((a, b) => a + b.share, 0), changePercent: null as number | null }
  })
  for (let i = 1; i < all.length; i++) {
    const a = all[i - 1]!, b = all[i]!
    // Compare only adjacent annual or monthly reporting periods, never mixed frequencies/gaps.
    const adjacent = /^\d{4}$/.test(a.period) && /^\d{4}$/.test(b.period) ? Number(b.period) === Number(a.period) + 1 : /^\d{4}-\d{2}$/.test(a.period) && /^\d{4}-\d{2}$/.test(b.period) && new Date(`${a.period}-01T00:00:00Z`).getUTCFullYear() * 12 + new Date(`${a.period}-01T00:00:00Z`).getUTCMonth() + 1 === new Date(`${b.period}-01T00:00:00Z`).getUTCFullYear() * 12 + new Date(`${b.period}-01T00:00:00Z`).getUTCMonth()
    if (adjacent && a.hhi !== null && b.hhi !== null && units(a.totalValue) > BigInt(0)) { const change = ratio(units(b.totalValue) - units(a.totalValue), units(a.totalValue)) * 100; b.changePercent = Number.isFinite(change) ? change : null }
  }
  return importDependencyResponseSchema.parse({ version: 'supply-1.0.0', periods: all, limitations: [...new Set(limitations)] })
}
