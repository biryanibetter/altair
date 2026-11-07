import { forecastRequestSchema, forecastResponseSchema, supplySnapshotSchema, type ForecastRequest, type ScenarioInput, type ScenarioSnapshot } from '@altair/shared/contracts'
import { applyScenarioChanges, simulateScenario, TWIN_ENGINE_VERSION } from '../intelligence/scenarios'
import { evaluateReplenishment } from '../intelligence/replenishment'

const DAY = 86400000
const quantity = (n: number) => Math.max(0, n).toFixed(6)
export function forecastInventory(raw: unknown, request: ForecastRequest, context?: { baseline: ScenarioSnapshot; scenario?: ScenarioInput; transport?: ScenarioSnapshot }) {
  const s = supplySnapshotSchema.parse(raw), q = forecastRequestSchema.parse(request)
  if (s.inventory.id !== q.inventoryId) throw Error('inventory_not_found')
  const start = Date.parse(s.evaluatedAt), iso = (days: number) => new Date(start + days * DAY).toISOString()
  const inv = s.inventory, limitations = ['daily_mean_stationary_demand_not_llm_prediction', 'planned_orders_are_additive_to_recurring_demand', 'reservations_excluded_once_orders_consume_only_unreserved_quantity', 'dates_are_estimates_not_delivery_commitments', 'no_unit_conversion', 'recommendations_do_not_assert_supplier_availability']
  for (const row of [...s.movements, ...s.orders]) if (row.inventoryId !== inv.id || row.unit !== inv.unit) throw Error('unit_mismatch_or_inventory_mismatch')
  for (const row of s.replenishments) if (row.unit !== inv.unit) throw Error('unit_mismatch')
  const baseline = context?.baseline
  let changed: ReturnType<typeof applyScenarioChanges> | undefined
  if (context?.scenario) {
    if (context.baseline.evaluatedAt !== s.evaluatedAt) throw Error('snapshot_time_mismatch')
    simulateScenario(context.baseline, context.scenario, TWIN_ENGINE_VERSION) // shared target validation
    changed = applyScenarioChanges(context.baseline, context.scenario)
    limitations.push('scenario_compatible_baseline_with_current_demand_history_and_orders')
  }
  const physical = changed?.snapshot.inventory.find(i => i.id === inv.id)?.quantity ?? inv.quantity
  if (Number(inv.reservedQuantity) > Number(physical)) limitations.push('scenario_reduction_impairs_reserved_stock')
  const available = Math.max(0, Number(physical) - Number(inv.reservedQuantity))
  const activeOrders = s.orders.filter(o => o.status === 'planned' || o.status === 'confirmed')
  if (activeOrders.reduce((n, o) => n + Number(o.reservedQuantity), 0) > Number(inv.reservedQuantity) + 1e-6) throw Error('order_reservations_exceed_total_reserved')
  // Back surviving reservations against earliest deadlines first. A scenario must
  // not make a destroyed reservation look like an already fulfilled commitment.
  let reservedBacking = Math.min(Number(physical), Number(inv.reservedQuantity))
  const orderDemand = [...activeOrders].sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt) || a.id.localeCompare(b.id)).map(o => {
    const backed = Math.min(reservedBacking, Number(o.reservedQuantity))
    reservedBacking -= backed
    return { day: Math.max(0, (Date.parse(o.dueAt) - start) / DAY), quantity: Number(o.quantity) - backed, impaired: Number(o.reservedQuantity) - backed }
  })
  const impairedReservations = Math.max(0, Number(inv.reservedQuantity) - Number(physical))
  const standaloneImpaired = Math.max(0, impairedReservations - orderDemand.reduce((sum, o) => sum + o.impaired, 0))
  if (standaloneImpaired > 0) orderDemand.push({ day: 0, quantity: standaloneImpaired, impaired: standaloneImpaired })
  if (activeOrders.some(o => Date.parse(o.dueAt) < start)) limitations.push('overdue_orders_due_immediately')
  const windowStart = Math.max(start - q.historyDays * DAY, inv.historyStart ? Date.parse(inv.historyStart) : start)
  // Full UTC-sized days immediately before evaluation. Partial days never dilute consumption.
  const n = Math.max(0, Math.floor((start - windowStart) / DAY))
  const samples = Array.from({ length: n }, () => 0)
  for (const m of s.movements) {
    const time = Date.parse(m.occurredAt)
    if (time > start) throw Error('future_movement')
    if (m.kind === 'consumption' && time >= start - n * DAY && time < start) samples[Math.floor((time - (start - n * DAY)) / DAY)]! += Number(m.quantity)
  }
  const mean = q.dailyDemand ?? (n > 0 ? samples.reduce((a, b) => a + b, 0) / n : null)
  let scenarioQuantity = 0, scenarioDays = 0
  if (changed && baseline) {
    const before = context!.scenario!.demand.find(d => d.productId === inv.productId && d.unit === inv.unit)
    const after = changed.input.demand.find(d => d.productId === inv.productId && d.unit === inv.unit)
    if (before && after) { scenarioQuantity = Number(after.quantity) - Number(before.quantity); scenarioDays = changed.input.horizonHours / 24 }
  }
  if (scenarioQuantity > 0) limitations.push('finite_scenario_demand_distributed_uniformly_only_over_scenario_horizon')
  const method = q.dailyDemand !== undefined ? 'explicit_daily_demand' : mean === null ? 'unavailable' : 'daily_mean'
  const variance = n >= 2 && mean !== null ? samples.reduce((sum, x) => sum + (x - samples.reduce((a, b) => a + b, 0) / n) ** 2, 0) / (n - 1) : 0
  const sd = Math.sqrt(variance)
  const uncertainty = n >= 14 && q.dailyDemand === undefined && mean !== null ? { dailyStandardDeviation: sd, mean95Low: Math.max(0, mean - 1.96 * sd / Math.sqrt(n)), mean95High: mean + 1.96 * sd / Math.sqrt(n), method: 'normal_approximation_independent_daily_samples' as const } : null
  if (mean === null) limitations.push('demand_history_unavailable')
  if (mean === null) limitations.push('commitments_only_lower_bound_recurring_demand_unknown')
  if (!uncertainty) limitations.push('insufficient_history_for_statistical_uncertainty')
  else limitations.push('normal_interval_assumes_independent_stationary_daily_demand_not_calibrated_stockout_probability')
  if (q.leadTimeDays === null) limitations.push('lead_time_unknown')
  const xMean = (n - 1) / 2, yMean = n ? samples.reduce((a, b) => a + b, 0) / n : 0
  const denominator = samples.reduce((a, _, i) => a + (i - xMean) ** 2, 0)
  const trend = n >= 7 && denominator ? samples.reduce((a, y, i) => a + (i - xMean) * (y - yMean), 0) / denominator : null
  const replenishments = s.replenishments.map(r => {
    const transport = baseline ? evaluateReplenishment(changed?.snapshot ?? context?.transport ?? baseline, baseline, { ...r, routeRequest: r.routeRequest ?? undefined }, changed?.unavailable, changed?.delays) : { status: 'unknown' as const, arrivalAt: null, reasons: ['replenishment_transport_snapshot_unavailable'] }
    const shipment = baseline?.shipments.find(sh => sh.id === r.shipmentId)
    if (baseline && shipment?.productId !== inv.productId) throw Error('replenishment_product_mismatch')
    const verified = r.confirmedQuantity !== null && r.verifiedUntil !== null && Date.parse(r.verifiedUntil) > start
    const confirmed = verified ? Math.min(Number(r.quantity), Number(r.confirmedQuantity)) : 0
    if (!verified) return { shipmentId: r.shipmentId, arrivalAt: transport.arrivalAt, quantity: quantity(0), status: 'unknown' as const, reasons: [...transport.reasons, 'supplier_availability_unverified_or_expired'] }
    return { shipmentId: r.shipmentId, ...transport, quantity: quantity(confirmed), reasons: [...transport.reasons, ...(confirmed < Number(r.quantity) ? ['insufficient_verified_supplier_quantity'] : [])] }
  })
  if (replenishments.some(r => r.status === 'unknown')) limitations.push('projection_excludes_unknown_replenishment_not_a_certain_shortage')
  const horizon = Math.max(q.horizonDays, (q.leadTimeDays ?? 0) + q.coverageDays, ...q.leadTimeAlternatives)
  const events = new Map<number, { receipts: number; orders: number }>()
  const at = (day: number) => { const t = Math.max(0, day); if (!events.has(t)) events.set(t, { receipts: 0, orders: 0 }); return events.get(t)! }
  for (let day = 0; day <= Math.ceil(horizon); day++) at(day)
  for (const o of orderDemand) at(o.day).orders += o.quantity
  if (scenarioQuantity > 0) at(scenarioDays)
  for (const r of replenishments) if (r.status === 'eligible' && r.arrivalAt) at((Date.parse(r.arrivalAt) - start) / DAY).receipts += Number(r.quantity)
  const project = (demand: number, until: number, collect = false) => {
    let balance = available, previous = 0, stockout: number | null = balance <= 0 ? 0 : null, safety: number | null = balance <= Number(q.safetyStock) ? 0 : null, maxDeficit = 0
    const rows: { at: string; available: string; unfilledOrderQuantity: string }[] = []
    for (const [day, event] of [...events].filter(([d]) => d <= until).sort(([a], [b]) => a - b).concat(events.has(until) ? [] : [[until, { receipts: 0, orders: 0 }] as [number, { receipts: number; orders: number }]])) {
      const rate = demand + (scenarioQuantity > 0 && previous < scenarioDays ? scenarioQuantity / scenarioDays : 0)
      if (rate > 0) {
        if (stockout === null && balance - rate * (day - previous) <= 0) stockout = previous + Math.max(0, balance / rate)
        if (safety === null && balance - rate * (day - previous) <= Number(q.safetyStock)) safety = previous + Math.max(0, (balance - Number(q.safetyStock)) / rate)
      }
      balance -= rate * (day - previous)
      maxDeficit = Math.max(maxDeficit, -balance)
      // Known arrivals at a deadline can fulfill that deadline; continuous demand cannot be retroactively supplied.
      balance += event.receipts
      const unfilled = Math.max(0, event.orders - Math.max(0, balance))
      balance -= event.orders
      if (stockout === null && balance <= 0) stockout = day
      if (safety === null && balance <= Number(q.safetyStock)) safety = day
      maxDeficit = Math.max(maxDeficit, -balance)
      if (collect) rows.push({ at: iso(day), available: balance.toFixed(6), unfilledOrderQuantity: quantity(unfilled) })
      previous = day
    }
    return { balance, stockout, safety, maxDeficit, rows }
  }
  const projected = project(mean ?? 0, q.horizonDays, true)
  const lead = q.leadTimeDays
  const committed = (until: number, inclusive = true) => orderDemand.filter(o => inclusive ? o.day <= until : o.day < until).reduce((a, o) => a + o.quantity, 0)
  const cumulativeDemand = (until: number) => (mean ?? 0) * until + (scenarioQuantity > 0 ? scenarioQuantity * Math.min(1, until / scenarioDays) : 0)
  let suggested: number | null = null
  if (lead !== null) {
    const end = lead + q.coverageDays
    // Maximum cumulative target deficit after lead time avoids oversupply caused by receipts arriving later.
    const receipts = (t: number, inclusive: boolean) => replenishments.filter(r => r.status === 'eligible' && r.arrivalAt && (inclusive ? Date.parse(r.arrivalAt) <= start + t * DAY : Date.parse(r.arrivalAt) < start + t * DAY)).reduce((a, r) => a + Number(r.quantity), 0)
    suggested = Math.max(0, ...[lead, end, ...[...events.keys()].filter(t => t >= lead && t <= end)].flatMap(t => [
      Number(q.safetyStock) + cumulativeDemand(t) + committed(t) - available - receipts(t, true),
      ...(t > lead ? [Number(q.safetyStock) + cumulativeDemand(t) + committed(t, false) - available - receipts(t, false)] : []),
    ]))
    if (project(mean ?? 0, lead).maxDeficit > 0) limitations.push('shortage_before_standard_lead_time_requires_expedite_or_order_reschedule')
  }
  return forecastResponseSchema.parse({
    version: 'supply-1.0.0', evaluatedAt: s.evaluatedAt, inventoryId: inv.id, unit: inv.unit, nature: changed ? 'simulated' : 'estimated',
    projectionBasis: mean === null ? 'commitments_only_lower_bound' : 'recurring_and_orders', impairedReservations: quantity(impairedReservations),
    scenarioDemand: scenarioQuantity > 0 ? { quantity: quantity(scenarioQuantity), horizonDays: scenarioDays } : null,
    availableStock: quantity(available), coverageDays: mean !== null && mean > 0 ? available / mean : null,
    consumption: { method, historyDays: n, averageDaily: mean, trendDaily: trend, uncertainty },
    stockoutAt: projected.stockout === null ? null : iso(projected.stockout), safetyStockAt: projected.safety === null ? null : iso(projected.safety),
    reorderPoint: lead === null ? null : quantity(cumulativeDemand(lead) + Number(q.safetyStock) + committed(lead)),
    suggestedQuantity: suggested === null ? null : quantity(suggested), recommendedOrderAt: projected.safety === null || lead === null ? null : iso(Math.max(0, projected.safety - lead)),
    leadTimeRisks: [...new Set([...(lead === null ? [] : [lead]), ...q.leadTimeAlternatives])].map(t => {
      const deficit = project(mean ?? 0, t).maxDeficit
      return { leadTimeDays: t, shortageBeforeArrival: deficit > 0 ? true : mean === null ? null : false, expectedShortage: quantity(deficit), stressDemandShortage: uncertainty && mean !== null ? quantity(project(mean + 1.96 * sd, t).maxDeficit) : null }
    }), replenishments, projection: projected.rows, limitations,
  })
}
