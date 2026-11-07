# ALTAIR Tasks 003–004: routing, risk and digital twin

Status: approved in full by the user; implemented and locally verified. Migrations were applied only to disposable local PostgreSQL, not a deployed database. Execution evidence is in the plan ledger and internal backend specification.

## Intent and supplied requirements

Build deterministic, explainable comparisons of feasible Qatar-bound logistics routes, then reuse that engine to evaluate private, reproducible disruption scenarios. Implement Task 003 first and Task 004 second. No LLM calculations, invented transport services, quotations, fees or availability. Demonstrations must explicitly label hypothetical connections and disruptions. Update `docs/internal/ALTAIR_BACKEND_SPEC.md` after verification and stop.

## Inspected foundation

- Existing Next.js monolith; shared Zod contracts, TypeScript backend services and Drizzle/PostgreSQL schema.
- `locations` has identifiers and kinds but no coordinates. `transport_connections` has directed endpoints, mode and nullable typical duration only.
- `risk_signals` has severity, location, disruption and source references but lacks evidence, observation time, confidence and edge targets.
- Private `scenarios` has owner, name, legacy text results and an optional owner-matched route-option reference. Inventory and shipments already use user ownership/RLS.
- Ingestion provides weather/marine forecasts and news evidence. It does not establish transport connections or confirm closures.
- APIs verify Supabase users and use their JWT/RLS. Existing tests include Vitest and disposable PostgreSQL via PGlite.
- The working tree contains substantial pre-existing changes. Preserve them.

## Proposed implementation decisions

These are builder proposals, not previously approved user choices.

### 1. Contracts and persistence

Keep the current package boundaries and add versioned contracts for route requests/results, network evidence, risk intelligence and scenarios. Extend existing tables rather than replacing them. Legacy rows remain valid; absent metadata stays unknown and cannot become evidence of availability.

- Locations: nullable validated longitude/latitude; support terminal nodes.
- Connections: structured, versioned routing metadata for explicit evidence/hypothetical status, distance, duration bounds, geometry, component costs and units/currency, restrictions, capacity, operational state, and provenance. Validate at the service boundary and add database shape/range checks for important persisted invariants.
- Risks: category, observation/validity times, evidence, confidence, rule version, location/connection/supplier targets and explicit potential/confirmed status. Preserve existing foreign keys. News remains potential evidence.
- Scenarios: versioned inputs, immutable baseline snapshot/reference hash, fixed evaluation time, assumptions, engine version and structured outputs. Preserve legacy results/route references. New scenario execution records are stored separately with owner-matched foreign keys if multiple executions are retained.
- Catalog data remains authenticated-read/trusted-write. Scenario creation/execution uses verified user identity and RLS, never a caller-supplied owner or elevated service-role read of private data.
- Validate persisted snapshots on read. Enforce snapshot/output size limits and atomic snapshot creation; never assemble a baseline from inconsistent, independently changing reads. A transactionally consistent, invoker-rights database function can capture the authorized baseline.

### 2. Deterministic route engine

Build a directed multigraph only from stored, explicit connections. Do not connect nearby points, infer reverse edges or infer port/airport transfers. Multimodal transitions require an explicit shared logistics node or transfer edge.

Use bounded uniform-cost graph search over simple paths with stable edge-ID tie-breaking. Search uses nonnegative, deterministic exploration weights; it does not prune solely by the final ranking preference. Evaluate every candidate within the configured search envelope, identify the Pareto frontier and rank independently of discovery order. Enforce maximum hops, expansions, graph size and alternatives; return truncation/coverage metadata. Pareto optimality is relative to evaluated candidates, never a global claim after truncation.

Request: origin/destination node IDs; shipment mass/volume, commodity and handling requirements; allowed modes and hypothetical opt-in; maximum duration/cost/hops, excluded locations/connections and minimum confidence; cost/time/risk priority weights. Strictly reject unknown keys, invalid IDs/numbers, negative values, all-zero priorities and conflicting bounds.

Connection feasibility is feasible, conditional or infeasible. Closures, insufficient known capacity, prohibited modes and explicit restrictions are infeasible. Unknown capacity, handling support or availability is conditional, not proven feasible. A strict request can exclude conditional alternatives. Hypothetical connections are excluded by default. Unknown cost/time cannot satisfy a hard cost/time ceiling.

Costs use fixed-point decimal arithmetic and component-level currency/unit labels; multiply only when the shipment supplies the required matching quantity. Sum independently by currency. Unknown freight/customs/handling costs stay unavailable, never zero. A route total is complete only when all required components are known. No implicit exchange rate. Cross-currency or incomplete totals are not presented as financially comparable.

Durations aggregate known leg and explicitly modeled transfer times. Unknown values remain unknown. Sum duration ranges conservatively; retain per-leg confidence and freshness and use the weakest applicable confidence for a conservative route summary. These are uncertainty bounds, not probabilistic guarantees.

Normalize comparable cost/time/risk objectives over the evaluated alternatives; apply normalized requested weights, expose each contribution and deterministic tie-breaks. Unknown objective values receive an explicit conservative missing-data penalty; report that such rankings are provisional. Do not declare Pareto dominance using unavailable or incomparable objectives. Risk exposure is a documented index, not an accident probability.

Return ordered legs, node IDs/coordinates, available GeoJSON LineStrings, explicit geometry gaps, component/subtotal/total availability, duration bounds, risk evidence, feasibility reasons, provenance, Pareto status, score breakdown, ranking explanation and search coverage. Never draw a fabricated straight line as provider route geometry.

### 3. Provider adapters

Add server-only HERE road and maritime adapter interfaces using the existing bounded transport layer. Providers may enrich an already explicit connection; geometry does not establish freight service, schedules, capacity or price. Cache provenance includes request parameters, acquisition/expiry times and provider attribution.

HERE integration uses current documented routing APIs and server-side credentials if configured. Maritime integration targets a documented routing provider with an explicit fixed endpoint/configuration; select the provider from available credentials and current documentation during implementation. If none is configured, expose `unconfigured` and test the adapter boundary without claiming a live integration. Never accept a caller-selected provider URL. Live paid requests require authorization; fixture tests cover failures and unavailable data.

### 4. Risk intelligence

Normalize weather, transportation, supplier and geopolitical observations through explicit, versioned rules. Signals require evidence, source, observation time, confidence and an affected entity. Weather location associations require curated node mappings or an explicitly documented weather coverage radius; this association never creates transport edges. News entity associations require curated evidence mappings, not title-based guesses.

Use documented configurable thresholds for supported weather variables and declared severity for structured operational observations. Label rule-derived severity as inferred. Preserve upstream forecast nature and stale evidence. Deduplicate by evidence/rule/target. Unmapped evidence is excluded from targeted exposure with coverage notes rather than silently assigned.

For applicable active signals, compute exposure from severity and confidence using a documented bounded weighted index; retain evidence and rule contributions. De-duplicate a signal encountered through multiple route nodes/legs. News alone can raise potential risk exposure but cannot close or reduce capacity. Operational state changes need explicit operational evidence or a scenario modification.

`GET /api/v1/risks` is authenticated, validated and paginated with target/category/freshness filters and source/coverage metadata. Supplier evidence derived from private operational records must remain owner-scoped; it must never be written into a shared catalog.

### 5. Isolated scenarios and supply impacts

At creation, capture a consistent, owner-authorized immutable snapshot of the relevant graph, evidence, route request, inventories, shipments and supplier references. Persist source IDs/versions, snapshot hash, evaluation time, assumptions and engine version. The snapshot is sufficient to rerun without reading changed live records or making provider calls.

Simulation is a pure copy-on-write transformation. Support edge closure/capacity reduction, cost/time increases, supplier unavailability, inventory reduction, demand increases and replenishment delay. Require unique targets per modification type; reject contradictory closure/capacity instructions, duplicate overrides, unknown/out-of-snapshot targets, invalid factors and incompatible units. Apply changes in a fixed documented order. Missing baseline cost/capacity cannot be manufactured by a multiplier.

The current schema has no demand series or shipment quantity/unit. Capture those as explicit, scenario-only assumptions when needed: product/unit, horizon demand, and replenishment quantity/arrival linked to an owned shipment. Otherwise return the affected supply metric as unavailable. Do not interpret a shipment count as an inventory quantity.

Calculate baseline and simulated routes with the same engine/settings. Report gained/lost/conditional routes, comparable cost/duration deltas and binding constraints. Supply impacts use like-for-like product/unit balances over the configured horizon: available inventory plus eligible replenishments minus demand, shortage and unmet quantities. Supplier unavailability excludes linked replenishments; closures/delays affect arrivals only where route/arrival dependencies are explicit. No probabilistic forecasts or assumed replacement suppliers.

Persist baseline and simulated outputs, input hashes, assumptions and reasons. Execution is idempotent for identical snapshot/input/engine versions; concurrent execution must not corrupt outputs. Unsupported old engine versions cannot silently execute as the current version. Real inventory, shipments, suppliers, connections and risk records are never modified by simulation.

### 6. HTTP surface

- `POST /api/v1/routes/compare`: authenticated route comparison against the authorized network; hypothetical use requires explicit opt-in.
- `GET /api/v1/risks`: authenticated risk evidence/exposure retrieval.
- `POST /api/v1/scenarios`: validate input and atomically create a private snapshot-backed scenario.
- `GET /api/v1/scenarios`: paginated creator-only list.
- `GET /api/v1/scenarios/:id`: creator-only inputs, assumptions and run status.
- `POST /api/v1/scenarios/:id/execute`: reproducible bounded execution, persist outputs.
- `GET /api/v1/scenarios/:id/compare`: stored baseline/simulation comparison; explicit not-yet-executed state.

All use `no-store`, bounded request bodies and sanitized errors. Use 400 for invalid inputs, 401 for missing identity, indistinguishable 404 for absent/other-owner scenarios, 409 for execution/version conflicts and 503 for required storage/provider failures. Disconnected networks are successful comparisons with zero alternatives and explicit reasons. Optional unavailable enrichment does not become a fabricated route or an unconditional API failure.

### 7. Demonstration and verification

Create an opt-in, local-only Qatar-bound fixture with explicitly hypothetical land/sea/air connections, assumptions and costs. Label every demonstration artifact as hypothetical, including the simultaneous Qatar logistics disruption. No automatic insertion into operational catalogs.

Write failing behavior tests before implementation, then verify:

- Directed paths, transfers, feasible/conditional/infeasible routes, closures, capacity/handling constraints and disconnected graphs.
- Exact cost aggregation, missing components, mixed currencies, duration bounds, stable Pareto results, different priorities, stable tie-breaking and reported search truncation.
- Invalid requests and provider missing credentials, malformed responses, errors and unavailable estimates.
- Risk category normalization, deduplication, staleness, explicit target mappings and news never closing edges.
- All scenario modifications, simultaneous disruptions, contradictory parameters, units, supply impacts and unsupported/missing baselines.
- Frozen baseline equality before/after execution, deterministic replay after live records change, concurrent/idempotent execution and engine-version enforcement.
- Disposable PostgreSQL migrations and real RLS with two identities: neither scenario inputs, snapshots, executions nor outputs cross owners. Anonymous access denied; cross-owner references rejected.
- Actual Next.js route wiring plus end-to-end local hypothetical creation → execution → comparison.
- Existing recursive tests, lint, typecheck and build. Record pass/fail/not-run accurately in the internal backend specification.

## Implementation sequence after approval

1. Detailed execution plan and failing contract/engine tests.
2. Task 003 schema extensions, graph engine, adapters, authenticated compare endpoint and focused verification.
3. Task 004 risk rules, snapshot persistence, scenario engine/endpoints and isolation tests.
4. Local hypothetical end-to-end demonstration, full checks and backend-spec update.

Current design checklist: foundation inspected; design drafted; independent architect builder review completed with “nothing important left”; user approved; Tasks 003–004 implemented and locally verified. No commits, pushes, production migrations, deployment or schedule activation occurred.
