# ALTAIR Backend Specification

Status: Tasks 002–007 implemented locally; Task 010 adds backend-owned integration selectors, owned shipment/warehouse writes and session refresh middleware. Historical per-task counts below are dated evidence, not current totals. Live OpenRouter access remains blocked until a rotated key is supplied locally. Deployment and production activation remain gated. Internal only; not linked from the public README.

## Task 010 — integration foundation (additive; prior task sections historical)

`packages/shared/src/contracts/integration.ts` defines strict selection/list, owned warehouse write and planned-shipment write/record schemas. `packages/backend/src/integration/http.ts` implements bounded, cookie-guarded selection/create/read handlers; `apps/web/lib/backend/integration.ts` uses the verified Auth user, owner-filtered Supabase PostgREST and existing table RLS (not the database-owner connection). The Next route wrappers provide GET `/api/v1/locations`, GET `/products`, GET+POST `/warehouses`, GET+POST `/shipments`, GET `/shipments/{id}`. All seven operations are no-store, protected by `auth.getUser()`, accept no owner field or caller-supplied SQL/network, and return sanitized 400/401/404/503. Pagination is exclusive UUID keyset with top-level nextCursor. See [Frontend Handoff §8](ALTAIR_FRONTEND_HANDOFF.md#8-task-010-additive-integration-contract-and-frontend-checklist) for exact inputs, outputs and front-end sequence; historical Task 009B references to missing catalog/shipment endpoints are superseded.

`apps/web/middleware.ts` refreshes SSR Auth cookies onto the downstream request and outgoing response, including Supabase cache-control headers; it excludes internal scheduler APIs/health/static assets and is not itself an authorization boundary. Existing route handlers verify identity separately. Browser sign-in, callback/PKCE and account-switch handling belong to the frontend; no browser page or token-bearer alternative was added. The local middleware test checks cookie propagation but is not an actual hosted Supabase Auth refresh test.

The Task 010 disposable PostgreSQL test seeds a labeled **HYPOTHETICAL** UAE→Qatar graph, equipment product, supplier evidence and owner stock. It creates a warehouse/shipment, compares routes, captures/executes/replays a private closure and stock loss, forecasts stock and searches a supplier whose availability remains unverified, then evaluates/persists a potential-stockout monitoring alert. It switches between two SQL-shimmed Auth UIDs to assert shipment/scenario/stock/warehouse/alert isolation. No fixture is seeded into real Supabase; simulated closures never become public confirmed risks. Separate tests already cover the approved AI mock-tool journey and direct risk reads. Neither test proves actual browser Auth, real provider/LLM, native multi-connection stress or production data.

No new migration was generated: these endpoints use the existing nine ordered migrations (`0000`–`0008`) and modeled tables. Before authorized staging migration, perform the read-only target ledger/schema comparison, 0005 existing-row CHECK/lock review, backup/restore rehearsal and two-real-user RLS/RPC checks in [System Status §8](ALTAIR_SYSTEM_STATUS.md#8-task-009b--integration-readiness-not-staging-approval), then follow Task 010's status gate. Do not run `db:migrate`, activate inactive Cron/Realtime templates or enable optional licensed feeds during local integration.

## Scope and architecture

### Task 009A local verification (supersedes historical CLI failure notes)

`packages/shared/src/contracts/package.json` sets `type: module` for the exported TypeScript contract subtree; the shared root `index.js` stays CommonJS. Native Node/tsx now exposes named star-reexports (`observationSchema` et al.) to the ESM backend/DB CLI, while Next.js still compiles the same Zod schemas. The real CLI prints usage for unknown jobs and returns sanitized `ingestion_unavailable` for `weather` with a deliberately invalid `DATABASE_URL`, without provider or database access. `packages/backend/test/cli.test.ts` starts a real Node child process for both cases. Existing fixture-backed ingestion tests still exercise provider normalization and disposable PostgreSQL persistence; no real database ingestion was attempted.

Official checksum-verified Node 22.23.4 was used locally (temporary runtime, not a committed binary); `.nvmrc` pins that patch version, root engines restrict to Node 22 and CI reads `.nvmrc`. pnpm 11.5.2 `install --frozen-lockfile` succeeded. Full offline suite: **179 passed / 7 opt-in skipped** (shared 9, db 10, backend 142, web 18); uncached web lint, build and four typechecks passed. An isolated source copy without `.git`, existing `node_modules`, `.next`, caches or local env files also passed frozen install, 179 offline tests, lint, build and post-build typecheck. Offline-only installation of that copy could not run because a pinned Prettier tarball was absent from the local pnpm store; the subsequent regular frozen install downloaded the locked package and passed. Turbo warned about unrelated Git ownership at `C:/` in this source copy but checks exited successfully; no global Git settings were changed. Local built Next server returned public health **503** with a deliberately invalid database URL and protected risks **401** without a cookie. These expected negative-path responses prove local API wiring, not live DB/Auth connectivity. GitHub-hosted CI, remote migrations and licensed/provider activation have not been verified.

External providers → reusable TypeScript adapters → Zod validation/normalization → PostgreSQL → domain services → `/api/v1` → frontend. One Next.js application on Vercel, one existing Supabase database; no microservices or Edge Functions. Tasks 003–004 add deterministic TypeScript graph routing, evidence-based risk rules and isolated simulation; no LLM participates in calculations. Frontend implementation remains out of scope.

| Domain | Existing models / ownership | Task 002 additions |
| --- | --- | --- |
| Logistics | locations, transport_connections, warehouses, shipments, inventory, route_options | Task 003 adds directed connection metadata and route comparison; operational records remain unchanged by calculations |
| Intelligence | products, suppliers, organizations (public directory), disruptions, risk_signals | Provider observations, trade, weather/marine, news evidence, HS classifications and published country dependency shares |
| Simulation | scenarios, future forecasts/outcomes | Task 004 adds private immutable snapshot-backed scenarios; provider forecasts remain estimated evidence, separate from simulations |
| Platform | Supabase Auth, owner-based RLS, alerts, data_sources, health API | Ingestion state/history, leases, bounded execution, scheduler authentication and freshness |

`packages/db` owns schema, migrations and trusted ingestion persistence. `packages/shared/src/contracts` owns public Zod contracts. `packages/backend` owns provider adapters, transport, normalization, ingestion and read services. `apps/web/app/api` and `apps/web/lib/backend` are thin server-only HTTP wiring. UI files are out of scope. Never import backend/db packages in client components; frontend imports shared contracts only.

## Schema reconciliation and security

Reuse all fourteen existing tables; never recreate Auth, products, sources or user ownership. Existing private tables retain owner_id → auth.users and their policies. Existing catalogs remain authenticated-read, trusted-write. Add `provider_observations`, `ingestion_state`, `ingestion_runs`; use existing `data_sources` through stable provider UUIDs. Observation payloads are versioned discriminated JSON contracts, indexed by kind/provider/time, with unique (job, record_key). No raw provider bodies or credentials are persisted in errors. Ingestion history is operational metadata: only trusted processes can read it directly; signed-in API consumers receive a sanitized summary.

Observations include source identifier, dataset/record key, attribution URL/license, observation/valid time, fetched time, expiry and nullable upstream modification time. Nature is live, historical, estimated or simulated. Unavailable is represented explicitly at the API/freshness layer, never as a fabricated zero-valued observation. Forecasts are always estimated. Re-fetching historical data does not turn it into live data. Freshness describes synchronization, not the age of the reporting period.

## Contracts (defined before implementation)

Every GET requires a verified Supabase identity and queries using its JWT/RLS. No browser provider credentials or ingestion secret. Responses use `Cache-Control: no-store`.

* `GET /api/v1/trade`: `{ data: Observation[], meta: { availability: 'available'|'unavailable', nextCursor: string|null } }`; filters job, limit (1–100, default 50), cursor. Includes trade, dependency and classification records. Values are decimal strings with explicit units/currency and native country labels/codes; never silently convert QAR/USD or HS editions.
* `GET /api/v1/weather`: same envelope; weather and marine observations, optional job, limit and cursor. Forecast payload specifies coordinates, variable, unit, valid time and numeric value.
* `GET /api/v1/ingestion/status`: `{ data: ProviderStatus[] }`; job, last attempt, last success, expiry, status, error code, next retry, cursor/coverage, nature and the five most recent run summaries (id, start, finish, status, count, error code). No stack traces, lease tokens or upstream response bodies. A narrowly scoped read-only SECURITY DEFINER RPC exposes only this projection to authenticated users; operational tables are not directly readable.
* `GET /api/v1/freshness`: `{ data: Freshness[] }`; job, last success, expiresAt, status (`fresh`, `stale`, `unavailable`), latest record nature or unavailable.
* `POST /api/internal/ingestion/[job]`: no body required, allowlisted job only; Bearer `INGESTION_SECRET` (minimum 32 characters), constant-time comparison. Response `{ job, status, count, runId? }`; 200 success/cached, 409 busy, 429 deferred, 503 missing configuration/provider/database failure, 401 unauthorized, 404 unknown job. All work awaited; no background worker inside handlers.

Exact executable schemas live in shared contracts and are the interface authority if examples are shortened here. Native Supabase PostgREST reads enforce catalog RLS; ingestion never uses a user-provided owner or bypasses private-table authorization.

## Provider behavior and limitations

* Qatar Open Data: documented public Explore v2.1 API; verified dataset `qatar-imports-2019-2024-copy` exposes monthly HS8, description, country, quantity, weight and QAR values. Default query is **2024 / HS prefix 10 (cereals)**, not all commodities or current trade. Configure `QATAR_TRADE_YEAR` and `QATAR_HS_PREFIX` (2–8 digits) to change scope. Aggregate upstream by year/month/HS8/description/country so customs rows cannot overwrite each other. Process deterministic pages of 100 groups; derive HS classification evidence from official descriptions without guessing edition or creating duplicate product catalog rows. Unknown country is null, not a made-up country. Country dependency shares use official `total-imports-by-main-country-of-origin-q4-2023` percentages; do not pretend this is current or comprehensive. Explicit page/partial coverage.
* UN Comtrade: annual HS trade API; configurable period/reporter/commodity, optional server-only subscription key. Public preview mode is explicitly limited, never claimed as full coverage. Monetary USD and native numeric country identifiers retained.
* Open-Meteo: forecast and marine public APIs, UTC hourly data, provider units checked. Numeric model output is estimated, not live station observations. Null values are unavailable, not zero. Attribution Open-Meteo / CC BY 4.0; review noncommercial free-tier terms before production.
* GDELT DOC 2.0: public article metadata only, no article scraping. News evidence is not confirmed disruption or computed severity. Retain source link and publication/seen time; respect publisher rights.

Every job uses typed validation before any observation writes, deterministic keys, transactional upserts, source attribution, cached synchronization windows, timeout, bounded retries for transient failures, Retry-After handling and persistent error codes/cooldowns. A leased PostgreSQL row serializes each job. Completion checks the lease token transactionally, preventing a timed-out invocation from overwriting a newer run. Failed runs preserve last-known-good observations and last success. Expired leases are recoverable; abandoned run history is marked interrupted on reclaim.

### Concrete execution rules

- Provider HTTP: at most three attempts, 8 seconds per attempt, 25 seconds total, exponential backoff with jitter; 2 MB maximum response. Never follow provider redirects or expose response/error bodies. 401/403 and malformed payloads are not retried. Long Retry-After values become database cooldowns; 429 without a delay defaults to 60 seconds. Retry-After is honored rather than truncated to fit serverless execution.
- Persistence: 90-second lease per job, row locking at claim and completion, token-fenced atomic observation/history/state updates. Database statement timeout 5 seconds, lock timeout 2 seconds; owner pool max 1 per runtime instance, prepared statements disabled for Supabase pooling. CLI explicitly closes the pool. A hard-killed handler leaves a visible running record that the next post-lease invocation marks interrupted.
- Cache: weather/marine 1 hour, GDELT 15 minutes, trade 24 hours after query completion. Incomplete Qatar pages use a 60-second continuation cache; the prepared 5-minute Cron trigger continues pages and returns cached after completion. Hash of the canonical request URL scopes cache/cursor state, so coordinate/year/commodity changes reset pagination and bypass old cache. Old evidence remains queryable by its explicit period/coordinates; no destructive replacement.
- Explore grouped `total_count` is **page-sized**, not total groups. Continue a full 100-row page; a short/empty page ends the configured query. At offset 10,000 stop with observable `query_partition_required` and require a narrower HS prefix instead of silently wrapping/claiming completeness. Scope-change recovery is supported; arbitrary bulk history is not claimed.
- Payload version is the `/api/v1` contract. Monetary/weight **numeric tokens** are preserved by Node >=22 JSON.parse reviver source context, expanded from exponent form with string arithmetic, validated and stored as decimal strings. They never pass through an IEEE-754 number in the live transport path. Unsafe already-decoded numeric input is rejected. This preserves upstream JSON precision, not precision already lost by a provider's own aggregation. Currency, native country identifiers and HS edition remain explicit. No currency conversion, dependency estimation, risk scoring or confirmed disruptions are inferred.
- Freshness is last successful synchronization plus expiry, separate from evidence nature and historical reporting period. An empty successful window may have a last-success timestamp but still returns unavailable when there is no stored evidence. API consumers can inspect individual record expiry; paginated trade coverage is always reported separately.

## Scheduling and local operation

Target: Vercel Node handlers with maxDuration 60 seconds and a shorter internal budget. One bounded page/window per HTTP call; no unbounded loops or detached work. Supabase Cron uses pg_net HTTP POST with a Vault-stored base URL and Bearer secret. `packages/db/operations/ingestion-cron.sql` is an operator-run template **outside migrations**, with `activate := false`; it does not create/change jobs by default. Weather hourly, marine hourly, news every 15 minutes, Comtrade/dependency daily; Qatar imports every 5 minutes for bounded continuation, cached daily after completion. Edit the schedule JSON to respect provider/deployment quotas.

Production activation requires reviewed migrations, deployment URL, Vault secrets `altair_base_url` / `altair_ingestion_secret`, matching Vercel `INGESTION_SECRET`, optional Vault `altair_vercel_bypass` if protection applies, and an authenticated smoke test. Only then may an authorized operator change the template activation flag and execute it. The template never contains secret values; they are read from Vault at request time. Monitor both cron.job_run_details/pg_net HTTP results and ingestion runs; successful SQL dispatch does not prove HTTP success, and no new run may mean delivery/authentication failed. The template includes a manual job-pause example. Leaving its flag false does not pause already-active jobs.

Local CLI runs exactly the same services without Vercel, with server-only environment configuration. Real database migration/remote writes require target review and authorization; no deployed database writes are implied by local tests.

### Local commands

```text
pnpm install --frozen-lockfile
pnpm --filter @altair/db db:generate
# Inspect the target and all migrations; obtain authorization before db:migrate.
pnpm --filter @altair/backend ingest weather
pnpm --filter @altair/backend ingest marine
pnpm --filter @altair/backend ingest qatar-imports
pnpm -r --if-present test
pnpm lint
pnpm typecheck
pnpm build
```

CLI loads root `.env.local`; Next.js uses `apps/web/.env.local`. Keep both server environments consistent, never commit either file. CLI does not require scheduler credentials, only a configured authorized PostgreSQL target and optional provider key. `COMTRADE_MODE=preview` is public/limited; subscription mode requires server-only `COMTRADE_API_KEY` in an HTTP header. Public providers do not depend on that key. New migrations are `0001_real_owl.sql` (tables, grants/policies, source registrations, status RPC) and `0002_certain_mauler.sql` (cache scope); they were applied only to disposable local PostgreSQL in this task, not Supabase.

Manual internal HTTP trigger (after configuring a local Next.js server and authorized test database):

```powershell
Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/api/internal/ingestion/weather' -Headers @{Authorization = "Bearer $env:INGESTION_SECRET"}
```

Read APIs require an actual verified Supabase session cookie; the scheduler secret does not grant access to user APIs. The internal POST accepts no caller-selected provider URL, owner ID or configuration.

## Verification / observed integration status

- [x] Shared contract validation and missing/stale/fresh distinction.
- [x] Provider malformed arrays/units/fields, missing credentials, transient errors/timeouts, rate limits and Retry-After tests with explicitly synthetic fixtures.
- [x] Actual local PostgreSQL engine (PGlite/WASM): migrations, duplicate upserts, batch/cursor rollback, lease exclusivity, stale-token fencing, interrupted-run recovery, configuration scope invalidation and cooldown persistence.
- [x] PostgreSQL roles: anon cannot read evidence; authenticated can SELECT evidence but cannot write it or directly read operational tables; sanitized status RPC is readable. Existing private-table model is unchanged.
- [x] HTTP authorization/query/error tests, real Next.js route wiring tests, normalized retrieval/pagination and stale synchronization.
- [x] Disabled scheduler template executes without Cron/Vault installed and does not create jobs.
- [x] External response → Zod normalization → local PostgreSQL → real loopback HTTP API returning 200 under PostgreSQL authenticated-role reads. No synthetic fallback.
- [x] Recursive tests, lint, typecheck and production build run; final counts and review findings recorded below.

Live verification on 2026-11-06 (opt-in `test/live.test.ts`, default config):

| Job | Live result | Evidence |
| --- | --- | --- |
| Qatar imports / HS classifications | PASS | 118 distinct observations stored from first 100 grouped 2024/HS10 rows; API returned 50 with cursor; partial query, not all Qatar imports |
| Qatar dependency shares | PASS | 6 historical Q4-2023 shares stored and retrieved |
| UN Comtrade public preview | PASS | 1 annual 2024 Qatar HS10 import record (USD, classification H6) stored and retrieved; subscription mode not live-tested |
| Open-Meteo weather | PASS | 144 estimated variable/time records stored; API returned 50 with cursor |
| Open-Meteo marine | PASS | 96 estimated wave-height/period records stored; API returned 50 with cursor |
| GDELT | NOT LIVE-VERIFIED | Public request returned 429 via research transport, then timed out within the bounded Node transport; PostgreSQL recorded provider_timeout with retry cooldown. Synthetic normalization/failure tests pass; no news observations fabricated |

The full opt-in live run was **5 passed, 1 failed (GDELT timeout)**, not a green all-provider run. Initial live investigation also exposed and fixed Qatar's date-typed filter and page-sized grouped count; both have regression tests. A first Comtrade attempt timed out; the subsequent complete attempt passed. Provider availability is not guaranteed by fixture tests.

After the numeric-token precision fix, all five accessible jobs were re-run against real providers and again passed storage/HTTP retrieval; GDELT was deliberately excluded from that focused repeat, not counted as passing.

Final local checks (Node 25.9.0, pnpm 11.5.2):

| Command | Result |
| --- | --- |
| `pnpm -r --if-present test` | PASS: 56 tests (shared 6, db 10, backend 32, web 8); 6 opt-in network tests skipped in normal suite |
| Full opt-in network suite | 5 passed, 1 failed: GDELT provider_timeout |
| Focused final live repeat for Qatar/Comtrade/weather/marine | 5 passed, GDELT excluded |
| `pnpm typecheck` | PASS across db/shared/backend/web (unchanged tasks may use Turbo cache; production build also checks application types) |
| `pnpm lint` | PASS; existing command covers web/API code, not a new standalone backend lint configuration |
| `pnpm build` | PASS; all five new API routes plus existing health route appear in Next.js output |
| `git diff --check` | PASS, only existing Windows LF/CRLF conversion warnings |

Independent code review identified exact trade numeric precision as Important; the failing unsafe-integer/exponent regression now passes and the complete suite is green. Deferred minor improvements: add an index for the status RPC's latest-fetched observation lookup; stress-test simultaneous claims over multiple native PostgreSQL connections (sequential lease/fencing behavior is tested); explicitly cancel rejected HTTP response bodies before retry (successful response bodies are already bounded/cancelled). These are not claimed as completed. No deployed-authentication or production readiness claim is made.

Reproduce with PowerShell (network tests deliberately skipped in normal CI):

```powershell
$env:ALTAIR_LIVE_PROVIDERS = '1'
pnpm --filter @altair/backend exec vitest run test/live.test.ts --reporter=verbose
```

Local proof does **not** prove deployed Supabase Auth cookie exchange, Supabase network/RLS installation, pg_net delivery, Vault access, Vercel time/plan limits or production schedules. Test Auth users/uid are shimmed locally; ordinary catalog roles/RLS are executed by PostgreSQL. No real Supabase schema/data, deployment, commit or push was changed. Before activation verify two actual Auth identities against the deployed project, plus production delivery, provider licenses/quotas and deployment-protection settings. Observation/history retention and broader commodity/backfill partition automation are future operational work; coverage is explicit and no completeness claim is made.

Production schedules inactive. Deployment, commits and pushes prohibited without authorization. Implementation status and observed live-provider results will be updated at completion.

## Task 003 — deterministic logistics comparison

Implementation: shared `contracts/routing.ts`, backend `src/routing/*`, server-only web wiring and `POST /api/v1/routes/compare`. Routing engine version `altair-routing-1.0.0`. It uses only explicit directed connections: no proximity-created edges, reverse services, imaginary airport transfers or flight/vessel availability.

### Network data and feasibility

`locations` gains nullable longitude/latitude (GeoJSON order is **[longitude, latitude]**) and terminal kind. `transport_connections.routing_metadata` is nullable version-1 JSON: hypothetical flag, provenance, distance, duration min/max, nullable LineString, component costs/basis/currency, cost coverage, state, capacities, supported handling, prohibited commodities and nullable declared risk index. Missing legacy metadata is unknown, not a reconstructed quotation or confirmed operation. Legacy typical duration alone cannot establish sourced door-to-door delivery time.

Connection provenance records source/link, observation/expiry times, confidence and live/historical/estimated/simulated nature. Catalog writes remain trusted-only; APIs read using verified user JWT/RLS. Invalid persisted contracts fail closed. `routing_network_snapshot()` and `intelligence_snapshot()` use a single invoker-rights SQL statement; sentinel rows above configured bounds trigger contract failure rather than a silent partial network.

Closures, zero/insufficient known capacity, excluded modes/IDs, prohibited commodities and unsupported handling remove edges. Unknown operational state, capacity for a requested quantity, handling or source freshness makes an alternative conditional; `requireConfirmed` excludes it. A hypothetical connection requires `allowHypothetical: true`. Unknown cost/duration cannot satisfy a hard ceiling. Missing estimates do not automatically make a transport connection impossible, but they are never described as a known zero or a confirmed delivery commitment.

### Request and response

All requests require a verified Supabase user, bounded JSON body (64 KiB) and strict Zod validation; no caller-supplied owner or network/provider URLs. Endpoint returns `Cache-Control: no-store`.

```json
{
  "originId": "10000000-0000-4000-8000-000000000001",
  "destinationId": "10000000-0000-4000-8000-000000000003",
  "shipment": { "massKg": 1000, "handling": ["ambient"] },
  "preferences": { "modes": ["land", "sea", "air"], "allowHypothetical": true, "enrichGeometry": false },
  "constraints": { "maxHops": 6, "maxAlternatives": 10, "requireConfirmed": false },
  "priorities": { "cost": 1, "time": 1, "risk": 1 }
}
```

IDs in this example belong only to the local hypothetical fixture, not a seeded production catalog. Optional shipment volume/commodity, excluded node/edge IDs, minimum confidence, max duration and currency-qualified max cost are defined in the executable schema. All-zero priorities, conflicting endpoints/exclusions and invalid numbers/unknown keys are rejected.

Response contains `engineVersion`, `evaluatedAt`, ranked `alternatives`, `rejected` edge constraints, `rejectedRoutes` final-confidence exclusions, empty-result `reasons`, `coverage` and explicit `assumptions`. Alternatives include ordered nodes/legs/edge IDs/modes; GeoJSON FeatureCollection of **available** leg geometries plus `geometryGaps`; per-component costs and currency subtotals; nullable complete comparable total; complete/known duration ranges; nullable distance/risk; risk evidence; confidence, provenance and hypothetical flags; feasible/conditional reasons; Pareto status and score contributions/ranking explanations. Optional `providerEstimates` are separately sourced navigational estimates, not replacement freight evidence. This structure is directly consumable by map/comparison clients without frontend changes.

Search is stable uniform-cost search over simple paths, weighted by known minimum leg duration (unknown exploration weight 1), independently of requested ranking priorities. Bounds: 500 nodes, 2,000 edges; default 6/max 10 hops; max 5,000 expansions; 20,000 queued states; 500 evaluated candidate paths; default 10/max 50 returned alternatives. Search truncation is explicit. Pareto status and rankings concern **evaluated candidates**, not globally optimal claims beyond the search envelope. Returned membership can change under limits, and comparisons explain this.

Money uses six-decimal fixed-point BigInt arithmetic, component quantities and half-up rounding, never floating-point aggregation. Costs are summed independently per currency; missing amounts/quantity/basis or partial coverage keep the total unavailable. No FX conversion, customs fee invention or quote retrieval occurs. Pareto comparison uses exact monetary values. Weighted scoring normalizes comparable objectives to the evaluated set, applies normalized priorities and a conservative missing-objective penalty; rankings with missing/incomparable data are labeled provisional. Ties use confirmed feasibility then stable edge IDs. Score is an index, not a monetary saving or probability.

Leg time bounds sum conservatively, as do known distances. Unknown time/distance stays unavailable; known partial durations remain separately visible. Unmodeled waiting/customs/transfers are explicitly not included. Confidence is the weakest applicable connection, component-cost and risk source confidence; the requested minimum is enforced again after final aggregation, with explicit rejected-route reasons. Risk is the maximum applicable declared/evidence-derived exposure index, not independent-event probability; unknown leg risk prevents a claimed complete route risk.

### Optional providers

- HERE Routing v8: fixed `https://router.hereapi.com/v8/routes`, truck mode, documented summary length metres/duration seconds and Flexible Polyline v1. Single-section 2D polylines become GeoJSON; unsupported dimensions/multi-section joins remain geometry-unavailable rather than invented lines.
- Searoutes shortest sea routing v2: fixed `https://api.searoutes.com/route/v2/sea/{lon,lat;lon,lat}`, `x-api-key` header, normalized coordinates, distance metres/duration milliseconds. Default vessel assumptions are disclosed. This is a navigational path, not a scheduled vessel service.
- Both use the existing bounded transport (timeouts, safe retries, no redirects, 2 MB response cap and sanitized errors). In-memory estimate cache is parameter-hashed, bounded at 100 entries and expires after one hour. No credential is returned or persisted in cache keys/provenance.
- Actual calls require server `ROUTING_ENRICHMENT_ENABLED=true`, the corresponding server-only `HERE_API_KEY` / `SEAROUTES_API_KEY`, and request `enrichGeometry=true`. At most two existing returned-route edges are enriched in parallel, each with a 10-second budget. Missing credentials/coordinates, errors and missing data return explicit unavailable/unconfigured entries. Enrichment never creates edges or changes service availability, price or logistics delivery time.
- No live or paid HERE/Searoutes calls were made. Fixture normalization/failure tests do not prove subscription access, commercial permission or upstream service coverage. Operator approval is required before enabling usage; review provider attribution/retention/license terms.

## Task 004 — risk intelligence and private digital twin

Shared contracts: `intelligence.ts`, `scenarios.ts`. Backend: `src/intelligence/*`. Twin engine version `altair-twin-1.0.0` records routing version, fixed evaluation time, input SHA-256 and normalized-snapshot SHA-256. Replays of unsupported engine versions are rejected rather than silently upgraded.

### Risk evidence and rules

`risk_signals` retains its legacy columns and gains optional connection/supplier references and validated `intelligence_metadata`. Structured evidence contains affected node/edge/supplier, category, severity, observation/applicability/expiry times, evidence text, source/link, confidence, nature, potential/confirmed status and rule version. Legacy rows without sufficient evidence are counted as legacy coverage, not assigned invented provenance/confidence.

Risk categories: weather, transportation, supplier and geopolitical. Structured transportation/supplier observations can retain explicitly confirmed status; geopolitical news is always **potential** and cannot confirm a closure. Neither normalization nor risk scoring writes connection states. New evidence must be ingested by trusted catalog processes; there is no user-facing global risk-write endpoint. Evidence derived from private supplier operations must not be published to shared catalogs.

Weather rule `weather-thresholds-v1`: medium/high thresholds for wind speed 50/70 km/h, precipitation 10/20 mm per reported hourly observation, and wave height 2.5/4 m. Unsupported units/variables and below-threshold observations do not become severity estimates. Source confidence for rule-derived weather signals is an explicitly assumed 0.6, status potential. Weather association requires the node's curated coordinates to match within 0.000001 degrees (effectively zero coverage radius); this never establishes a transport edge. News requires separately curated target evidence; no title guessing/geographic auto-closure. Unmapped observations are counted.

Hourly weather forecast applicability starts at its provider valid time and ends at the earlier of that hour's end or observation expiry. Synchronization time is distinct from forecast valid time. Forecasts that expire before applicability cannot become active signals. Evidence retains estimated nature and expiry. Active exposure deduplicates IDs across route nodes/edges, uses severity weights low=.25, medium=.5, high=.75, critical=1, multiplied by source confidence and by .5 for potential evidence. The maximum applicable contribution is the bounded exposure index; all contributions/evidence are returned. No signal is not evidence of zero risk.

Risk reads use a consistent snapshot of network + structured signals + weather/marine/news observations from the last seven days (explicit evidence window, not comprehensive intelligence). Bounds: 1,000 catalog risk rows and 5,000 observations; sentinel overflow fails closed. `GET /api/v1/risks` requires authentication and supports category, targetId, freshness active/stale/all, limit 1–100/default 50 and UUID cursor. Response `{data,meta:{availability,nextCursor,evaluatedAt,coverage}}`; coverage includes unmapped observations, legacy signals and rule descriptions. Route comparison uses the same targeted signals, without automatic closures.

### Snapshot isolation, inputs and persistence

Existing creator-owned `scenarios` is extended rather than replaced: `simulation_input`, `baseline_snapshot`, `baseline_hash`, `engine_version`, `simulation_output`. Legacy text results/route-option references remain valid. A new typed scenario is captured by a database INSERT trigger using invoker rights and the caller's RLS in one statement snapshot. It captures the explicit network, relevant evidence, owner-visible inventory/shipments, their supplier references, source IDs/update versions, and a fixed time. It does **not** read another owner's records or use service-role private reads.

Inputs/snapshot/reference/engine/identity are immutable after insertion, including against direct authenticated SQL updates. The raw PostgreSQL JSON reference uses MD5 as a non-security content identifier; execution additionally records canonical SHA-256 hashes. Outputs are set once, row-locked on persistence, and identical concurrent saves are idempotent. Conflicting results cannot overwrite a completed run. The API validates persisted contracts and recomputes stored outputs from the immutable snapshot before serving comparisons/replays; a directly forged owner output cannot be served as a verified calculation. Snapshot replay makes no provider calls and does not reread operational tables.

`create_simulation` / `finish_simulation` are narrowly granted SECURITY INVOKER RPCs, not service-role entry points. Existing scenario RLS is unchanged; verified-user filters also apply in web reads. Cross-owner reads/executions return indistinguishable 404. Snapshot target checks reject absent/cross-owner inventory and shipment references in the creation transaction. Bounds: 64 KiB request/input, 2 MB raw snapshot, 8 MB stored output, 1,000 inventory rows, 1,000 shipments, 1,000 relevant supplier IDs, 100 modifications, 100 demand assumptions and 10 replenishments. Sentinel overflow prevents a success claim on silently truncated baselines. Execution never updates operational inventory, shipments, suppliers, connections or risk rows.

Scenario input is strict `{name,routeRequest,horizonHours,hypothetical,assumptions,demand,replenishments,modifications}`. Horizon is default 168/max 8,760 hours. `demand` items explicitly supply product/unit/quantity; `replenishments` supply owned shipment ID/unit/quantity and optionally an explicit matching route request. These are scenario-only assumptions because the operational schema has no demand history or shipment quantity. No shipment count becomes a stock quantity.

Supported modifications:

| kind | Parameters / behavior |
| --- | --- |
| connection | edgeId; closed=true **or** capacityFactor 0–1 and/or costFactor/timeFactor 1–1000; unknown baseline values stay unknown |
| supplier_unavailable | supplierId from the snapshot; excludes explicitly linked replenishments |
| inventory_reduction | inventoryId and decimal reduction quantity, never below zero |
| demand_increase | productId/unit and additive quantity; requires a matching explicit demand baseline |
| replenishment_delay | shipmentId and positive delayHours; requires a matching explicit replenishment |

Duplicate target modifications, closure plus multipliers, invalid/unknown targets, incompatible units and unsupported versions fail closed. Changes apply to a deep copy in stable canonical order; original raw and normalized baselines remain unchanged. Modified connection/cost provenance is labeled simulated and linked to original evidence. Baseline and modified conditions use the same routing request/settings, engine and evaluation time.

Supply balances use exact product/unit quantities over the horizon. Known starting stock plus eligible assumed replenishments minus explicit demand gives shortage/unmet quantity; missing stock/demand/arrival/routing baselines return unavailable metrics, not fabricated zero. Delivered/cancelled replenishments are not added again; overdue arrivals are not assumed delivered. An explicit replenishment route request permits route unavailability or increased maximum route duration to delay/exclude arrivals; without one, route dependencies are disclosed as unspecified and not guessed. If either replenishment route search is truncated, supply metrics are incomplete/null rather than a confirmed shortage. Supplier unavailability and explicit replenishment delays still apply. There is no demand forecast, unit conversion or automatic supplier substitution.

### Scenario APIs

| Endpoint | Result |
| --- | --- |
| POST /api/v1/scenarios | 201 creator-only snapshot-backed record with inputs/reference/assumptions/version; no output until executed |
| GET /api/v1/scenarios | paginated creator-only summaries; limit default 20/max 100, UUID cursor; legacy untyped records excluded |
| GET /api/v1/scenarios/:id | creator-only typed inputs, immutable snapshot and nullable output |
| POST /api/v1/scenarios/:id/execute | no request parameters; deterministic calculation and idempotent persisted output |
| GET /api/v1/scenarios/:id/compare | verified stored baseline/simulation output; 409 if not executed |

Output includes baseline/simulated route comparisons and supply balances, gained/lost/conditional returned-route IDs, currency-comparable preferred cost delta, preferred duration delta, binding constraints, modification explanations, assumptions, engine versions and hashes. Route deltas are not global network-availability claims beyond reported search/result bounds. All endpoints require verified Supabase identity and no-store; invalid input 400, missing identity 401, inaccessible scenario 404, execution/version/integrity conflict 409, unavailable/malformed required storage 503. Disconnected networks return successful comparisons with no alternatives, not invented fallbacks.

### Local hypothetical Qatar demonstration

`packages/backend/src/routing/demo.ts:qatarRoutingDemo()` is explicitly **HYPOTHETICAL**, with UAE export hub → Qatar arrival terminal (sea) → Doha distribution hub (land), plus hypothetical direct air and land alternatives. All services, coordinates, capacities, costs and transit times are teaching assumptions, not documented operational transport connections or freight quotations. No real schedules/customs fees/flight availability are asserted. Geometry is unavailable rather than fabricated straight lines. Nothing automatically seeds operational catalogs.

Assumed shipment: 1,000 kg ambient; sea+land USD 600 / 38–46 hours, air USD 2,000 / 5–9 hours, direct land USD 900 / 20–24 hours. The local HTTP demonstration closes the hypothetical sea connection and doubles hypothetical air cost: the sea+land alternative disappears and remaining alternatives are recalculated. It creates only disposable local PostgreSQL records and replays the stored snapshot.

```text
pnpm --filter @altair/backend exec vitest run test/routing.test.ts test/routing-http.test.ts
pnpm --filter @altair/backend exec vitest run test/risks.test.ts test/scenarios.test.ts test/simulation-database.test.ts test/intelligence-http.test.ts
pnpm --filter @altair/web test
pnpm -r --if-present test
pnpm lint
pnpm build
# Run after build, not concurrently: Next.js regenerates .next/types during build.
pnpm typecheck
```

### Task 003–004 verification and activation gates

- Task 003 passed its standalone gate **before** Task 004 implementation: 71 tests passed, six opt-in live-provider tests skipped; lint, typecheck and production build passed. An initial BigInt/ES2017 type error was fixed without frontend config changes. An initial concurrent build/typecheck race was resolved by sequential verification.
- New tests cover directed/disconnected networks, mode/capacity/handling/closure/hypothetical filtering, conditional evidence, exact/mixed/unknown costs, Pareto/truncation and cost/time/risk priorities; provider unavailable/malformed/auth failures and unit normalization.
- Risk tests cover targeted evidence, confidence/severity, deduplication, stale/future forecast applicability, pagination and news never closing routes.
- Twin tests cover every modification, simultaneous disruptions, conflicts/units/unknown targets, preserved baselines/operational inventory, replay after live catalog change, absent stock/demand, route-dependent replenishment, identical concurrent executions and owner isolation.
- Disposable PGlite/PostgreSQL executes all migrations, invoker functions, immutable triggers and authenticated/anonymous RLS with two identities. Auth user verification is shimmed locally; deployment is not proven by local role tests.
- End-to-end proof is real loopback HTTP → pure engine → authenticated PostgreSQL snapshot/output persistence → comparison and replay; actual Next.js server handler imports/wiring are tested separately with mocked external Supabase transport.
- Final independent code review identified two Important correctness findings: truncated replenishment search being treated as certain unavailability, and minimum confidence not being rechecked after component/risk aggregation. Both were reproduced with failing tests, fixed and followed by the green full suite. No Critical findings were reported. A narrow list-status RPC also avoids loading full outputs for scenario summaries.
- Final checks on 2026-11-07: `pnpm -r --if-present test` **96 passed, 6 skipped** (shared 6, db 10, backend 69, web 11; skips are opt-in live-provider cases); `pnpm lint` PASS; `pnpm build` PASS; uncached post-build `pnpm exec turbo run typecheck --force` PASS. Offline `db:generate` reports no schema changes. The build retains a non-blocking existing Tailwind no-utility-classes warning; frontend styling was not changed.
- The first Task 004 production build caught a static-route handler signature mismatch that mocked handler tests did not catch; thin Request-only wrappers fixed it and the production build/uncached typecheck were rerun successfully.
- Local overlapping HTTP executions use actual PGlite-backed persistence and return identical outputs; PGlite serializes one database connection, so real multi-connection lock contention remains unverified. Exercise that against authorized PostgreSQL before production activation.
- No live HERE/Searoutes access, remote migration, deployed Supabase session exchange, production data writes, schedule activation, commit, push or deployment occurred. Existing Task 002 live-provider observations above are historical evidence, not a fresh live run for this task.

New migrations `0003_lyrical_spacker_dave.sql` (routing metadata/coordinates/invoker snapshot) and `0004_cuddly_mephistopheles.sql` (risk/scenario metadata, snapshot protection and invoker RPCs) were tested only against disposable local PostgreSQL. Before authorized activation review/apply them to the intended target, exercise actual Supabase Auth sessions with two identities, confirm license/quotas/provider credentials if enabling enrichment, and test production resource limits. No frontend files were intentionally changed by Tasks 003–004.

## Task 005 — supply intelligence and forecasting

Implemented in shared `contracts/supply.ts`, backend `src/supply/*`, shared crisis transport evaluator `src/intelligence/replenishment.ts`, and server-only API wiring. Response version: **`supply-1.0.0`**. Deterministic calculations only; no LLM forecasting, new service, frontend change, duplicate inventory/supplier/product/shipment/trade table, provider call or operational simulation write.

### Reconciled models and security

Existing `inventory` gains `reserved_quantity` and nullable `history_start`; existing `shipments` gains owner-linked `inventory_id`, quantity/unit, nullable `confirmed_quantity`, `verified_until` and explicit `route_request`. Warehouses remain the storage-location model; products remain the product catalog. Quantities on inventory/movements/orders retain the existing three-decimal precision; HTTP input rejects extra precision rather than silently rounding. Shipment quantities permit six decimals. Units must match exactly; no case normalization or conversion between mass, volume, packs or product-specific units.

Only five normalized child tables are added:

| Table | Purpose / protection |
| --- | --- |
| inventory_movements | Owner-only receipt, consumption, adjustment_in/out ledger; quantity, unit, occurrence time and owner-scoped unique idempotency key |
| planned_orders | Owner-only outstanding planned/confirmed commitments, required quantity, allocated reservation, unit, due date; fulfilled/cancelled records excluded from forecasts |
| supplier_evidence | Trusted public supplier sourcing evidence, source URL/description, observation/expiry and confirmed/inferred status |
| supplier_products | Existing supplier/product links and/or explicit HS classification + edition, tied to evidence for the same supplier |
| supplier_capabilities | Normalized supplier capabilities tied to evidence for the same supplier |

Private child records use composite inventory/owner foreign keys and RLS `(select auth.uid()) = owner_id`. Public supplier references remain authenticated-read/trusted-write, separately protected from private stock/procurement. Public search never exposes shipment confirmations or private inventories. Supplier/catalog writes are through authorized trusted processes, not a new global write API. Existing supplier rows gain verification status and timestamps; no existing row is silently marked verified.

Inserted movements lock their owned inventory and atomically update the current quantity; invalid units, future occurrences, negative stock/reservation violations and duplicate keys roll back the entire statement. Corrections use new movements, not ledger edits/deletes. Direct duplicate requests return an invalid/conflicting record error and do not apply twice. Existing privileged Auth account-deletion cascades remain possible; direct authenticated ledger edits/deletes are rejected. Importing historical movements must start from the appropriate opening balance, not reapply history to a balance already including those movements.

Reservations are explicitly declared total allocations on inventory, with per-order allocations bounded by both order quantity and the total inventory reservation. Standalone reservations are supported by the unallocated remainder. Parent locking and triggers enforce limits and immutable product/unit/warehouse identity; mismatched shipment product, owner, unit or route endpoints are rejected. Changing an order status is a declaration, not automated physical execution: record actual consumption/receipts as movements and release allocations explicitly. No catalog match or order status invents a goods movement.

### Forecast method and combined replenishment

`POST /api/v1/forecasts` accepts inventoryId, historyDays (default 28/max 365), horizonDays (default 90/max 365), coverageDays (default 30/max 365), safetyStock in the inventory unit, nullable leadTimeDays (default unknown/max 365), up to ten alternative lead times, optional explicit dailyDemand and an optional owned scenarioId.

1. **Consumption:** sum consumption movements into trailing complete 24-hour bins anchored at evaluation time. Only days inside explicitly declared `history_start` count; missing movements within that declared complete window mean zero consumption. Null history start or no complete days means unknown demand, not zero. Receipts/adjustments do not become consumption. Average daily consumption is `sum(daily consumption) / observed complete days`. An explicit caller dailyDemand overrides the mean and is labeled `explicit_daily_demand`.
2. **Trend and uncertainty:** at least seven days permits a descriptive least-squares slope of daily consumption against day index; it is not extrapolated as a growth forecast. At least fourteen days and no explicit dailyDemand permits sample daily standard deviation and a clipped normal-approximation 95% interval for the mean, `mean ± 1.96 * sd / sqrt(n)`. A separate stress-demand shortage uses `mean + 1.96 * sd`. These assume independent stationary daily samples; neither is a calibrated service level or stockout probability. Short/missing history returns null statistical uncertainty with limitations.
3. **Available stock:** `max(physical quantity - total reservations, 0)`. Dated orders consume only their unreserved required quantities, so allocations are not subtracted twice. Planned and confirmed order demand is additive to recurring consumption; callers must avoid counting the same future demand as both an order and a recurring-demand assumption. If a scenario destroys reserved stock, surviving reservations back earliest-deadline orders first, with stable ID tie-breaking. Uncovered allocations become dated order demand; impaired standalone reservations are immediately due. Impairment is returned explicitly.
4. **Projection:** deterministic event-time balance of available stock minus continuous recurring demand and dated order requirements plus eligible receipts. Arrivals at an order deadline can fulfill that deadline; they cannot retroactively prevent an earlier shortage. Overdue orders are immediately due. Negative balances represent cumulative unfilled demand. Daily/event projection entries expose available balance and unfilled order quantities. First free-stock exhaustion and safety-stock threshold dates are estimates within horizonDays, not promises or dates beyond the evaluated horizon. Coverage is available stock / positive mean consumption; zero or unknown rate returns null coverage, not infinity.
5. **Missing demand:** known orders/reservation impairments still produce a `commitments_only_lower_bound` projection and minimum procurement requirement using no invented recurring demand. Average consumption stays null. This is a lower bound with respect to additional recurring demand under the eligible-receipt model, not certainty about unknown receipts. Lead-time risk can prove a known deficit; absence of such a deficit remains unknown rather than a false no-shortage claim.
6. **Coverage-first purchase:** over the interval from known lead time L through L + coverageDays, recommend the nonnegative maximum cumulative net deficit needed to retain configured safety stock while satisfying order deadlines. Evaluate before/after receipt and order events, crediting only eligible receipts by their actual dates. Reorder point is safety stock + recurring/scenario demand through L + uncovered orders due through L. Suggested order date is the forecast safety-stock threshold minus L, clamped to now. Deficits before standard delivery require expediting or rescheduling, explicitly warned. Later orders remain visible in the requested projection; an order outside the current purchase window does not force immediate excess procurement. This is an explainable net-requirements rule, not a globally optimal multi-period purchasing solver; no MOQ, price break, shelf-life or service-level optimization is claimed.
7. **Unknown lead time:** no assumed immediate delivery. Lead-dependent purchase quantity/reorder point/order timing remain unavailable; explicitly supplied alternative lead times can still be evaluated.

Example request (IDs must refer to caller-owned real records; this is not a seed):

```json
{"inventoryId":"10000000-0000-4000-8000-000000000001","historyDays":28,"horizonDays":90,"coverageDays":30,"safetyStock":"20","leadTimeDays":7,"leadTimeAlternatives":[7,14,30]}
```

Responses include method/version/time/nature, projectionBasis, available stock, coverage, mean/trend/uncertainty, stockout/safety dates, reorder point, purchase quantity/timing, impaired reservations, finite scenarioDemand, alternative lead-time shortage estimates, per-shipment eligibility/adjusted arrival/reasons, event projection and explicit limitations. Statistical arithmetic is numerical and quantities are reported to six decimals; this is not financial decimal arithmetic. Unknown demand, unknown transport and supplier availability never become confirmed zero-risk facts.

### Route and crisis reuse

`evaluateReplenishment` is extracted from the existing twin engine, which now calls that same evaluator; existing twin behavior/version and regression tests are preserved. Both services use the same route comparison, supplier-unavailability handling, explicit replenishment delays, route-duration deltas, bounded-search uncertainty and missing/overdue-arrival rules. Operational shipment quantity is never inferred from shipment count. Delivered/cancelled shipments are not credited again. Quantities with absent/expired private availability verification are excluded and labeled unknown; partial verified quantity is capped to the request and labeled insufficient. Confirmation is an explicit owner-maintained procurement assertion, not verification supplied by the public supplier catalog.

Route-dependent adjustment requires a shipment's explicit matching route request. Missing dependencies are disclosed, not guessed from geographic proximity. Missing route estimates, conditional alternatives and truncated searches remain unknown; unavailable routes/suppliers exclude replenishment. Historical risk evidence alone does not confirm a closure or invent a delay. Scenario connection/transport changes automatically affect route-linked receipt dates through the shared evaluator.

For scenario-linked forecasts, the stored scenario is owner-filtered and version-checked. Normalized stock, shipments, network, risk evidence and supplier references must match its immutable snapshot; changed baselines return **409 `scenario_baseline_changed`**, requiring a newly captured scenario. Evaluation time and current orders/history are explicit forecasting overlays; this API is not a persisted forecast replay. `applyScenarioChanges` applies the existing engine's isolated modifications without updating stored scenarios or operational records. Additional scenario demand is a finite additive quantity distributed uniformly only across the scenario's horizon; it never permanently raises recurring daily demand. Forecast response nature is simulated when a scenario is used.

### Supplier intelligence

`POST /api/v1/suppliers/search` accepts optional productId, HS prefix + mandatory classification/edition, countryCodes, locationId, required capability names, limit (default 20/max 100) and UUID cursor. Matching requires all specified criteria; HS matching is prefix-based only within the same declared classification, countries/locations are explicit, and capabilities are case-insensitive exact names, not language-model guesses. No product-description or geographic-distance inference creates a confirmed offering.

A confirmed catalog match requires current supplier verification and fresh confirmed sourcing evidence for matching product/classification and every requested capability. Stale, unverified or inferred evidence can return `potential_match`, with reasons; rejected suppliers are excluded. Evidence/source links and timestamps are returned. Matching score is an explanatory index, not probability, availability or an ordering commitment; pagination uses stable supplier UUID order. Every match explicitly returns **availability `unverified`**, including confirmed catalog matches. Public directory evidence cannot establish available quantities, delivery capacity or fulfillment of a private order.

### Import dependency intelligence

`POST /api/v1/import-dependencies` reads existing ingested trade observations, filtered by exact reporter, commodity HS code, classification and currency, with optional provider, affectedOrigins, owned scenarioId and explicit originCountryMappings `{origin,countryCode}`. It never mixes QAR/USD or HS editions and does not recursively aggregate overlapping HS levels. Commodity-specific concentration cannot be inferred from the separate published aggregate main-country percentage dataset. Multiple comparable providers require explicit selection (409), avoiding duplicate counting. Annual and monthly periods remain separate; trends compare only adjacent periods of the same frequency.

For each period, sum non-aggregate, known origin trade values using variable-scale BigInt decimal aggregation; ingested precision beyond six decimals and unsafe-JavaScript-integer amounts is preserved. Relative shares are numerical, computed at twelve decimal places. World/total/all/0 and unknown partners are excluded, never treated as countries. For observed positive total V, `share_i = origin_value_i / V`, **HHI = sum(share_i²)** on a 0–1 scale, effective origins = 1/HHI, and top-origin share = max(share_i). No eligible positive origin total means unavailable concentration, not zero dependency. Period value changes use comparable preceding totals; no seasonal adjustment, currency conversion or economic causality claim.

Active targeted risk evidence and scenario affected edges/suppliers identify relevant origin country codes using the existing network/catalog. Exposure is the summed share of observed origins linked to those countries or explicitly supplied affectedOrigins, not expected loss or disruption probability. Native provider origin names/codes are retained: mapping a location country code to a provider-native origin requires explicit caller-supplied mapping, disclosed as an assumption, not a newly verified shared reference. Unmapped affected countries are explicitly excluded with a limitation. Potential risk evidence remains potential, never proof that all imports from a country have stopped. Freshness expiry is disclosed separately from the historical reporting period.

**Concentration limitations:** denominators cover ingested observed origins, not necessarily complete national imports; source query/page/preview coverage from Task 002 still applies. Missing origins, source classification, value vs physical quantity, intra-period aggregation and changed origin coverage can distort concentration and trends. Values cannot establish private stock, supplier capacity, substitutability, independence of origins or calibrated disruption risk. Zero observed exposure is not proof of no national exposure. Source observations and detailed attribution remain available through `/api/v1/trade`.

### APIs, bounds and local verification

All endpoints require a verified Supabase user and JWT/RLS reads/writes, bounded 64 KiB JSON bodies, strict shared Zod inputs/validated outputs and no-store responses. Caller-selected owner IDs, networks and provider URLs are rejected.

| Endpoint | Behavior |
| --- | --- |
| GET /api/v1/inventory | Owner-only stock rows, optional productId/warehouseId, limit default 50/max 100, UUID cursor |
| POST /api/v1/inventory | Create stock linked to owned warehouse and public product |
| PATCH /api/v1/inventory/:id | Update total reservation and/or explicit history start; physical changes use movements |
| POST /api/v1/inventory/movements | Insert immutable, atomic owner movement |
| POST /api/v1/inventory/orders | Create outstanding planned/confirmed order with quantity/deadline/allocation |
| PATCH /api/v1/inventory/orders/:id | Replace declared order fields/status for caller-owned record |
| PATCH /api/v1/inventory/replenishments/:id | Attach quantity, stock destination, private verification and route dependency to an existing owned shipment |
| POST /api/v1/forecasts | Deterministic stock/coverage/order and scenario-aware forecast; read-only calculation |
| POST /api/v1/suppliers/search | Protected public catalog matching, no private procurement fields |
| POST /api/v1/import-dependencies | Historical observed-origin concentration/trend/exposure |

Creation returns 201, reads/updates/calculations 200; invalid input or storage constraint/conflicting mutation 400, unverified identity 401, missing/inaccessible private resource 404, scenario version/baseline or ambiguous trade-provider conflict 409, required unavailable/malformed storage 503. Storage messages/credentials are never returned. These APIs do not place orders, book transport or execute a procurement workflow.

`supply_inventory_snapshot` uses a single SECURITY INVOKER statement combining owner stock, movements/orders/linked shipments and the existing simulation baseline. Limits are 10,000 recent movements (365-day evidence window), 1,000 active orders and 100 active replenishments per inventory, plus existing twin/network bounds. Supplier snapshot limit is 500 suppliers and 1,000 entries per child collection; filtered trade limit is 10,000 observations. Sentinel overflow and 4 MB normalized supply/catalog payload limits fail closed rather than silently claiming complete intelligence. Forecast request lead/coverage totals can evaluate a purchase window up to 730 days; displayed stockout/event projection remains bounded by horizonDays.

Migration **`0005_chilly_thing.sql`** contains generated extensions plus reviewed RLS, composite-FK ordering, locking/validation/ledger triggers and invoker snapshots. It was applied only to disposable local PGlite/PostgreSQL. Offline `db:generate` reports no further schema changes. Review and explicitly authorize real target migration before deployment; no remote database, scheduler, provider, paid API, commit, push or deployment was changed.

Verification completed locally on the session's 2026-11-07 task date:

- `pnpm -r --if-present test`: **121 passed, 6 skipped** (shared 9, db 10, backend 89, web 13; skips are opt-in live-provider tests, not passing live results).
- `pnpm build`: PASS, all new versioned handlers included; existing frontend route output preserved. Initial build retained the pre-existing non-blocking Tailwind no-utility-classes warning.
- Post-build `pnpm exec turbo run typecheck --force`: PASS. `pnpm exec turbo run lint --force`: PASS (existing web/API lint scope; no separate backend ESLint configuration invented).
- `git diff --check`: PASS for tracked changes, with pre-existing Windows LF/CRLF warnings. New backend/API files were also inspected during review; no frontend code was intentionally edited.
- Tests exercise consumption/binning and explicit zero days, missing demand/lead time, commitments-only deficits, units/precision, combined reservations/orders, verified/partial/stale replenishment, scenario route delays/supplier unavailability, stale/inferred supplier evidence, HS-edition separation, HHI/trends/unknown origins/full decimal preservation, active-risk country mappings and strict API authentication/errors.
- Actual disposable PostgreSQL executes migrations/RLS/FKs/triggers, two owner identities, duplicate rollback, immutable ledger, preserved Auth deletion cascade, reservation constraints, invoker snapshot → real forecast HTTP-handler computation, trusted supplier snapshot → matching, and cross-owner 404 behavior. Actual Next.js wiring is tested with mocked external Supabase transport; the production build checks handler signatures. No deployed Auth session exchange or native multi-connection contention is claimed.
- Independent code review found four Important forecast defects: scenario-impaired reservations, finite scenario demand being extrapolated indefinitely, changed scenario baselines and missing-history suppression of known order deficits. All four were reproduced with failing tests, corrected and followed by the full green suite. A separate account-erasure regression also failed before its trigger fix and passes afterward. No Critical findings or deferred review minors were reported.

Production follow-up remains gated: authorized migration review/application, two real deployed Supabase identities, representative demand-history quality checks, current private supplier verification, explicit country-code curation and concurrent-write/resource-limit testing. Browser/UI verification was not performed because no frontend behavior was changed. Task 005 stops here.

## Task 006 — live logistics evidence and private monitoring

Version **`monitoring-1.0.0`**. Implementation lives in `packages/backend/src/monitoring/*`, existing provider/ingestion/read services, shared `contracts/monitoring.ts` and the existing `alerts` table. The only new table is owner-keyed **`monitoring_settings`**: rule configuration, explicit route mappings, baseline estimate assumptions, forecast requests and evaluation metadata. No duplicate tracking, shipment, stock, risk, source, image or notification store is created. No frontend screen changes.

### Provider adapters and truth boundaries

All new integrations are **disabled by default**. Configuration is server-only; production activation requires authorization, applicable licenses/attribution/retention approval and quotas. No new provider was live-called in Task 006; test observations are explicitly synthetic fixtures, never production fallback data.

| Integration | Implemented behavior | Actual operational/access status |
| --- | --- | --- |
| OpenSky | Opt-in bounded `GET https://opensky-network.org/api/states/all`; required configured WGS84 bounding box. Retains ICAO24 ID, actual `time_position` and coordinates; skips absent positions. Anonymous current-state access supported; optional externally maintained OAuth Bearer token, never legacy Basic Auth | Fixture/PostgreSQL verified only. `OPENSKY_ENABLED=true` and approved usage required; no current external availability or coverage claim. Token acquisition/rotation is operator-managed |
| HERE Traffic v7 | Separate flow/incidents jobs using `https://data.traffic.hereapi.com/v7/{flow,incidents}`, bbox and shape location referencing. Stable incident originalId when supplied (otherwise version ID); flow ID hashes returned shape. Retains jam factor, nullable speed, road status, applicability and source update time | Requires `HERE_TRAFFIC_ENABLED=true`, server `HERE_API_KEY` and licensed access; no live/paid calls. Flow confidence >0.7 is live; otherwise speeds are estimated, not claimed live. Missing speed remains null |
| AISStream | PositionReport-only server WSS subscription, geographic filter, MMSI and upstream UTC event time; valid coordinates only. Bounded 10-second collector, maximum 500 frames/2 MB per connection, maximum three connections, exponential reconnect backoff/jitter and full resubscription | Requires key, `AISSTREAM_ENABLED=true`, `AISSTREAM_RUNTIME=worker` and non-Vercel Node runtime. Explicitly disabled on Vercel. No HTTP polling endpoint is invented. Run the existing CLI ingestion command in an authorized external worker/scheduler; no daemon was deployed. Current Node native socket uses uncompressed frames; review AIS bandwidth limits before activation |
| Existing Open-Meteo weather/marine | Same jobs/store and Task 004 environmental rules; forecasts stay estimated | Historical Task 002 live results above remain the only live verification; not re-run here |
| Existing GDELT/disruption intelligence | Reuses structured risk intelligence and news-evidence semantics; news does not confirm closure | GDELT was not newly live-verified; prior timeout is not reclassified as operational |
| Authorized shipment tracking | Continues to use existing private shipment records, last owner update, verification and route dependency | No shipment-provider credentials or provider-specific authorization found in configured environment. No vendor, tracking response, cargo position or shipment webhook is fabricated. Add a reviewed vendor contract only after access exists; this task makes no external shipment-tracking claim |
| Cameras | Optional `createCameraJob(reviewedManifest, authorizedMetadataCollector)` implements the existing ProviderJob/Batch interface. Requires explicit per-feed license, authorization reference, public-webcam purpose and HTTPS public-facing feed URL; normalizes only collector-supplied timestamped availability metadata into existing observations | Default `webcams` job is unconfigured/disabled. No collector or feed was connected. Adapter itself performs **no camera HTTP request, discovery, authentication, proxying, image capture or image storage**. Never use private CCTV/security infrastructure/restricted feeds; manifest attestations require human review. Core rules never depend on cameras |

New normalized kinds are `aircraft`, `vessel`, `traffic`, `webcam`. Provider identity, upstream record identity, coordinates where relevant, source/license, event time, fetched time, synchronization expiry and event-age `data.freshUntil` are retained. Public transport/camera metadata has `evidenceOnly=true`. **Vessel/aircraft broadcasts are network observations, not proof that any shipment/cargo is aboard or at that position.** Neither proximity nor a tracking-number similarity links them to cargo.

Position freshness is event time + 120 seconds; road/webcam metadata is event time + 300 seconds. Replaying an old event does not refresh its event age. Synchronization timestamps remain separate. `/freshness` uses the earlier of sync expiry and latest event freshness for these jobs; `/ingestion/status` adds nullable `evidenceFreshUntil`. Individual observation freshness remains authoritative for mixed-age batches. Future provider timestamps beyond 30 seconds fail normalization; future incident applicability is not active yet. Latest-per-road-ID selection happens before freshness filtering, so an older closure cannot override a newer open report. Event keys include provider record ID/time and are upserted through the existing leased transactional ingestion store.

Provider failures preserve last good observations and last successful sync. Existing HTTP budgets, timeout/backoff/Retry-After handling, sanitized errors, claim leases, fencing and cooldowns are unchanged. New explicit unconfigured codes include `integration_disabled` and `runtime_unsupported`. A quiet connected AIS window may legitimately contain no broadcasts; an all-failed connection sequence is a provider failure, not empty fabricated success. AIS has no durable replay guarantee; bounded-window coverage is explicit.

### Configuration and rules

`monitoringConfigSchema` is the executable authority. All six rules have independently configurable enabled/severity fields (default enabled/high). Default stale threshold is 24 hours, cost increase 20%, route-duration increase 2 hours. Up to 50 monitored shipment mappings, 10 inventory forecast requests and 100 HERE ID-to-edge mappings; each shipment/mapping supports at most 20 existing edges. Private IDs must belong to the caller; graph references must exist, and HERE mappings must refer to land edges. Geographic proximity never creates a route dependency. A shipment's existing private `route_request` supplies route-calculation parameters, not duplicate route storage. Baseline cost/duration are explicitly configured comparison assumptions, not newly verified freight quotes.

| Rule | Evidence / actionable behavior |
| --- | --- |
| `stale_shipment` | Nonterminal shipment's owner-maintained updated_at exceeds configured age; request a verified carrier/owner update. Broadcasts do not refresh it |
| `disrupted_route` | Fresh explicitly mapped road congestion/incident/closure, fresh curated closed connection or active high/critical non-weather targeted risk; review carrier impact and compare alternatives. Potential risk stays potential |
| `severe_environment` | Existing active high/critical environmental signals targeted to explicitly monitored route nodes/edges; review forecasts/schedule rather than declaring closure. Uses existing exact-coordinate forecast association, not a new radius guess |
| `increased_cost` | Existing route engine's preferred evaluated alternative versus positive baseline estimate, only with complete same-currency totals and current non-hypothetical connection/component evidence. Exact fixed-point money comparison; percentage rounded to four decimal places. Missing/mixed/stale/future evidence stays unknown, no FX conversion |
| `route_delay` | Current preferred route maximum duration with current non-hypothetical connection evidence exceeds configured baseline by the threshold; verify ETA/expedite. This is an estimate comparison, not measured cargo lateness |
| `potential_stockout` | Calls the existing `forecastInventory` with actual owner stock, consumption/orders and verified replenishments. A transient network overlay applies explicitly mapped current road closures through shared `evaluateReplenishment`; stored connections and stock never change. Unknown receipts/demand remain unknown and forecast limitations accompany the alert |

AIS/aircraft/webcam data is not a closure or a shipment-position rule. Congestion alone does not invent a delay multiplier. Current cost/duration evaluation uses existing route evidence; no search-truncated route comparison becomes a confident cost/delay alert. Monitoring uses current operations, not stored simulations. Inventory forecasts retain Task 005 missing-demand lower bounds and verified-quantity rules.

Example configuration (replace UUIDs with real caller-owned/catalog IDs):

```json
{"staleShipmentHours":24,"costIncreasePercent":20,"routeDelayHours":2,"shipments":[{"shipmentId":"10000000-0000-4000-8000-000000000001","edgeIds":["10000000-0000-4000-8000-000000000002"],"baselineCost":{"amount":"500","currency":"USD"},"baselineDurationHours":24}],"inventories":[],"trafficMappings":[]}
```

### Alert lifecycle, deduplication and isolation

Existing alerts gains rule/target, severity, dedup key, state, action/evidence, occurrence, notification count, acknowledgment/resolution timestamps; existing IDs/title/read_at/owner/shipment links remain valid. Unique `(owner_id,dedup_key)` identifies one rule/target episode. Initial trigger notifies once; unchanged repeated evaluations do not update the alert or notify. Changed evidence/severity decreases update details without another notification. Severity escalation reopens acknowledgment and increments notification_count; a recurrence after resolution increments occurrence and notification_count. Notifications here are **durable in-app alert episodes**, not claimed email/SMS/push delivery.

Lifecycle: open → acknowledged/resolved; acknowledged → resolved; a verified recurrence/escalation → open. Acknowledgment is idempotent, retains the condition and prevents repeated notification of the same active severity. Explicit manual resolution can reopen on the next still-active evaluation; acknowledgment is the correct way to accept an ongoing condition. Evidence-based route/environment rules stay latched for review (or terminal shipment) when upstream evidence vanishes/expires—no outage is misrepresented as recovery. Calculable stale/cost/delay/stockout rules can auto-resolve only when their input is actually evaluable. Disabled/removed configurations are not proof of recovery and do not silently erase old alerts; resolve them explicitly.

`monitoring_snapshot()` combines owner shipments, existing intelligence and configured existing supply snapshots under invoker rights. Road selection is restricted to configured provider IDs and takes the latest version per provider/job/ID **before** applying bounds; retained historical versions cannot disable unrelated monitoring. Sentinel limits: 100 shipment rows, 5,000 distinct selected road observations from last 24 hours, 10 supply contexts, 8 MB raw monitoring snapshot; existing network/supply/risk limits also apply. Overflow/malformed/missing required storage fails closed. Config updates rotate a revision. Reconciliation locks the owner's settings, checks revision/time and atomically updates existing alerts; older or repeated evaluation timestamps cannot undo newer results. Evaluation age is bounded to five minutes, with 30 seconds future tolerance. Timestamps are normalized to API milliseconds; an equal-millisecond collision returns a retriable conflict rather than applying twice.

All private access retains owner RLS; target validation prevents cross-owner alert/config references, including direct SQL. RPCs are SECURITY INVOKER with fixed search paths, explicit owner filters and narrow grants; anonymous cannot call them. As with other owner-editable operational declarations, direct authenticated SQL can author that user's own alerts/configuration; these are never accepted as trusted shared/public risk evidence. Authenticated alert deletion is revoked; use lifecycle transitions. No shared observation contains private shipment inventory/tracking fields.

The scheduler is trusted by the existing >=32-character `INGESTION_SECRET`; it accepts no owner/configuration input. It takes at most five persisted owner settings per bounded 25-second invocation, then evaluates each inside a transaction using `SET LOCAL ROLE authenticated` and the exact database-selected owner's JWT subject. Private snapshot queries therefore still execute RLS rather than service-role private reads. A five-minute per-owner attempt cadence and sanitized owner-only error code prevent an invalid owner's configuration from monopolizing every run; failures preserve alerts and do not block other owners. Monitor last_attempt_at/last_evaluated_at/error_code as well as HTTP results. These fields are scheduling metadata, not freshness proof for individual providers.

### APIs, Realtime and scheduling

| Endpoint | Contract |
| --- | --- |
| GET /api/v1/observations | Protected transport observations (aircraft/vessel/traffic), existing envelope, job/UUID cursor/limit 1–100; per-record freshness/evidence-only semantics |
| GET /api/v1/monitoring/config | Caller config, defaults when not configured |
| PUT /api/v1/monitoring/config | Strict config replacement, stored only for verified caller |
| POST /api/v1/monitoring/evaluate | `{}`; read caller snapshot → deterministic rule/forecast evaluation → fenced atomic alert reconciliation; returns candidates, evaluated scopes, limitations and changed count |
| GET /api/v1/alerts | Owner-only alerts; state, UUID cursor, default 50/max 100 limit; includes legacy alerts |
| PATCH /api/v1/alerts/:id | `{ "state": "acknowledged" }` or `resolved`; owner-only, missing/cross-owner indistinguishable 404 |
| POST /api/internal/monitoring | Scheduler Bearer authentication; optional `{}` only, no selected owner; sanitized evaluated/failed/changed totals; 503 on any provider-independent evaluation failure |

User APIs verify the actual Supabase identity, use JWT/RLS and no-store responses; strict bounded 64 KiB input, no caller-selected owner/provider URL. Invalid input 400, unverified identity 401, missing alert 404, superseded/configuration-changed evaluation 409, unavailable/malformed storage 503. Scheduler secret never authorizes user reads. No detached work in handlers.

`packages/db/operations/monitoring-realtime.sql` is an **inactive operator template**, not a migration. When explicitly activated it adds only existing `public.alerts` to an existing Supabase Realtime publication without dropping/replacing the publication. Authorized frontend consumers subscribe to INSERT/UPDATE under their user JWT/RLS; owner filters are efficiency, not authorization. No frontend screen/subscription is auto-created. Refetch authorized alert state after reconnect; deduplicate notifications by alert ID, occurrence and notification_count. Do not subscribe to DELETE; RLS is not applied to Realtime deletions. No FULL replica identity or private old-row payload is introduced.

Existing Cron template remains `activate=false`, with separate `enable_transport=false`. It now contains optional monitoring every five minutes and separately gated HERE/OpenSky five-minute polling. Anonymous OpenSky quotas/coverage must be reviewed; 120-second evidence can be stale between polls, intentionally reported rather than relabeled fresh. At five owners per trigger, larger installations require a reviewed cadence/budget and native concurrent-load testing; no unbounded tenant sweep is claimed. AIS and cameras are deliberately absent from serverless Cron. CLI `pnpm --filter @altair/backend ingest aisstream` uses the same ingestion service in an explicitly authorized worker environment; it collects one bounded window and exits.

### Task 006 verification and activation gates

Migrations **`0006_live_monitoring.sql`** and **`0007_outgoing_hiroim.sql`** (partial traffic identity/time index), with generated Drizzle snapshots/journal, are local-only. Disposable PostgreSQL executes schema extensions, owner RLS, config/target triggers, snapshot/reconciliation/transition functions and trusted scheduling with two owner identities. No real Supabase migration, data write, schedule/publication activation, deployment, paid provider call, camera access, commit or push occurred.

Tests cover stable event upserts, event-age stale data despite recent sync, absent/invalid/future position handling, HERE normalization/credential redaction, AIS reconnect/backoff/resubscription/outages, camera authorization gating, provider failure preserving good observations, all alert rules, missing evidence, no transport/cargo inference, owner isolation, config-change/old-result fencing, acknowledgment/idempotency, repeated notification suppression, severity escalation, resolve/reopen episodes, real owner stock → existing forecast → persisted alert without stock mutation, scheduler bounds/failure isolation, and actual Next.js route authentication/wiring. External provider transports are fixtures; Auth UID is shimmed locally but PostgreSQL roles/RLS execute. Real multi-connection contention, deployed JWT exchange and Supabase WebSocket delivery remain unverified.

Final local gates on 2026-11-07:

| Command | Result |
| --- | --- |
| `pnpm -r --if-present test` | **149 passed, 6 skipped**: shared 9, db 10, backend 115, web 15; skips are opt-in public-provider network cases |
| `pnpm exec turbo run lint --force` | PASS (existing web/API lint scope) |
| `pnpm build` | PASS; all monitoring/alerts/observations/internal monitoring routes included |
| Post-build `pnpm exec turbo run typecheck --force` | PASS across all four typed packages |
| `pnpm --filter @altair/db db:generate` | No schema changes; snapshot/journal consistent |
| `git diff --check` | PASS for tracked changes; existing LF/CRLF conversion warnings only |

Independent read-only review identified three Important defects, each reproduced with failing tests before correction: expired/future route estimates being eligible to trigger/clear cost/delay alerts, future-dated curated closures triggering early, and retained traffic versions overwhelming snapshot limits. All are fixed; stale/future/unknown-expiry/hypothetical metric evidence stays unevaluable, curated closures must be currently applicable, and a 6,000-version road-history regression returns only its latest mapped record. The complete suite/build/types were rerun after fixes. The AIS reconnection test's original 30 ms wall-clock budget was also replaced by an injected immediate-reconnect test with a realistic collection deadline; no production timeout was enlarged to mask a failure. OpenSky's nonstandard quota cooldown header is honored by the shared bounded transport.

Deferred review minors: terminal delivered/cancelled shipments do not automatically clear previously raised cost/delay alerts; owners must resolve these manually. Actual native overlapping transactions/lock contention remain untested because PGlite serializes one connection; SQL locking/fencing and sequential supersession are tested, not a multi-connection load claim.

The existing opt-in live-provider suite retains its original six public providers; new licensed/disabled providers are not silently called by setting that flag. Production requires reviewed migration authorization, real two-user Auth/RLS/Realtime tests, current provider access/licenses/quotas, explicit route/traffic mapping and baseline assumptions, authorized demand/verification quality, deployment resource/concurrency checks and separately approved Cron/publication activation. Do not interpret fixture success as an operational live integration. Task 006 stops after this internal specification update.

## Task 007 — tool-driven AI decision intelligence

Version **`assistant-1.0.0`**. Shared contracts are in `contracts/assistant.ts`; provider-neutral `LlmProvider`, OpenRouter adapter, allowlisted tools, bounded execution, orchestration and HTTP service are in `packages/backend/src/assistant/*`. Server-only wiring is `apps/web/lib/backend/assistant.ts`; the endpoint is **`POST /api/v1/assistant/chat`**. No frontend screen, new dependency, deterministic algorithm replacement, booking or procurement integration was introduced.

### Provider configuration and observed availability

Initial provider: OpenRouter's documented Chat Completions API, fixed `https://openrouter.ai/api/v1/chat/completions`, model **`openrouter/free`**. Official documentation index `https://openrouter.ai/docs/llms.txt` and current tool/structured-output/provider-routing documentation were consulted. ALTAIR controls its tool loop; no provider-side tool execution, agent SDK, dynamic tool installation or external document browsing occurs.

```dotenv
ALTAIR_LLM_PROVIDER=openrouter
ALTAIR_LLM_BASE_URL=https://openrouter.ai/api/v1
ALTAIR_LLM_MODEL=openrouter/free
OPENROUTER_API_KEY=
```

Both ignored local files, root `.env.local` and `apps/web/.env.local`, now contain this configuration. Existing unrelated variables were preserved. The key is **absent** in both files and the process environment; the exposed chat key was deliberately not copied. Rotate it and supply its replacement exclusively in local server configuration. `.env.example` contains placeholders only; `git check-ignore` confirms both local files are ignored. Production browser bundles contained **zero** OpenRouter credential markers. No key was hardcoded, requested in chat, logged, committed or sent to a provider.

Missing credentials or a non-OpenRouter/disabled provider configuration safely returns `llm_disabled`. Unsupported base URLs and paid model IDs fail closed. The adapter permits `openrouter/free` or an explicitly configured `:free` model; requests additionally require supported parameters and maximum prompt/completion prices of zero. No paid fallback is possible. The free router is intended to select a compatible available free model for the requested tools, but actual availability/reliability is **not live-verified**. No alternative model was selected without evidence. If the opt-in live test fails after local credentials are supplied, inspect sanitized failure codes, verify current tools-capable free model availability and document the tested explicit `:free` selection before switching. No model change or paid usage is authorized by this task.

### Tools and service reuse

| Tool | Existing service / truth boundary |
| --- | --- |
| `compare_routes` | Existing `createRouteHandler` → deterministic route engine and current authenticated intelligence snapshot; never creates routes, prices or feasible edges; optional provider enrichment is prohibited |
| `disruption_intelligence` | Existing risk handler and source-backed targeted risk normalization; potential intelligence is not a confirmed closure; simulated evidence remains hypothetical |
| `inspect_inventory` | Existing inventory list handler/store, explicit owner filter and caller JWT/RLS; owner-maintained stock is not current physical verification |
| `inspect_shipment` | Existing private shipment table, caller owner filter/JWT/RLS and strict record projection; no broadcast-to-cargo inference or invented tracking update |
| `forecast_inventory` | Existing supply forecast handler, including scenario/baseline validation and shared replenishment evaluator; unknown history, receipts and lead time stay unknown |
| `search_suppliers` | Existing supplier matching handler/evidence store; current verified catalog matches remain distinct from potential matches, and availability remains `unverified` |
| `create_simulation` | Existing private snapshot-backed scenario creation handler; explicit creation permission and approved full input required; operational tables never change |
| `run_simulation`, `compare_simulation` | Existing owned-scenario execution/integrity/comparison handlers; immutable baseline and hypothetical results retained |
| `import_dependencies` | Existing dependency handler and deterministic trade analysis; reporter/HS edition/currency remain explicit and no provider mixing or FX conversion occurs |

All arguments are validated with the existing strict Zod domain schemas **before dispatch**, including unknown-key rejection. Output is revalidated at the model boundary. IDs never grant permission: existing user services enforce JWT/RLS and owner checks; inaccessible shipments, forecasts and scenarios return indistinguishable not-found states. All assistant tool stores reuse the verified caller and bounded user client, not a service role. Thin domain-handler wrappers share existing algorithms, snapshot rules and storage validation.

The import-dependency HTTP response gains an additive optional `sourceObservations` metadata array populated from the **same observations already used** by the calculation. This exposes record/source IDs, record keys, URLs, licenses, nature and observation/synchronization/expiry timestamps without another read or any calculation change. Other clients remain compatible; the deterministic calculation function remains unchanged.

### Request, assumption approval and response

Input is strict `{message, conversationId?, allowSimulationCreation?, approvedToolInputs?}`. `conversationId` must belong to the caller; a new one is allocated otherwise. Owner IDs, networks, provider URLs and credentials are never accepted. Default creation permission is false, and approved inputs default to empty.

The model identifies a task, requests allowlisted tools, receives validated evidence, then selects evidence fields and safe review actions. **Schema-valid model assumptions are not authorized user assumptions.** Route comparison, scenario creation and import analysis require a matching entry in the current request's `approvedToolInputs`. Forecasting with only an owned inventory ID and existing default settings is permitted; any non-default history/horizon/coverage/safety/demand/lead-time/scenario input requires matching approval. Both proposed and approved inputs are parsed through the domain schema and compared canonically after defaults. Simulation creation also requires `allowSimulationCreation=true`. Approvals are not inherited from conversation history.

Without approval, no calculation or scenario creation is dispatched. The response includes `pendingToolRequests` containing validated **proposals, not verified facts**, plus `tool_approval_required`. The client/user must review those assumptions before submitting the matching approval. This confirmation step deliberately prevents a model from inventing demand/lead time and laundering the resulting deterministic numbers into evidence.

Example lookup (real records are selected through caller authorization):

```json
{"message":"Inspect my inventory records."}
```

Example explicitly approved forecast (replace the UUID with an owned inventory ID):

```json
{"message":"Estimate replenishment using my declared demand of 10 units/day and 5-day lead time.","approvedToolInputs":[{"tool":"forecast_inventory","arguments":{"inventoryId":"10000000-0000-4000-8000-000000000001","dailyDemand":10,"leadTimeDays":5}}]}
```

Successful HTTP orchestration returns Zod-validated `{version,status,task,conversationId,turnId,evaluatedAt,explanation,findings,recommendations,evidence,errors,limitations,pendingToolRequests}`. Status is `ok` or `degraded`; provider errors are not presented as successful inference. Tasks are routing, disruption, inventory, forecasting, suppliers, simulation, imports or clarification. A clarification can contain no findings/recommendations and makes no operational claim.

Each evidence envelope contains a current-request ID, tool, validated parameters, parameter authority (`user_approved` or `record_lookup_or_defaults`), retrieval time, exact backend data, record references and source/uncertainty/limitation metadata. Findings select exact scalar JSON pointers in this request's successful evidence only. Missing/null/object/forged/prototype references fail closed. Facts refer to operational/catalog declarations, estimates to calculations, predictions to potential risk intelligence and hypothetical labels to simulations/simulated inputs; these labels do not upgrade source reliability or freshness.

The model does **not** author unchecked factual prose. Finding fields are limited to structured numerical/date/enum/version fields, with controlled string values; arbitrary units, supplier descriptions, titles, names, news evidence and document prose cannot become a factual finding. Full raw source data remains available as explicitly untrusted evidence. The server renders exact field values and safe review-action templates. Recommendations must reference existing evidence and an appropriate tool (e.g. replenishment review requires a forecast). No freight quotation, supplier availability, regulation, real-time update or operational feasibility can be supplied from model memory.

### Privacy, prompt-injection defense and persistence

The model receives a fixed server system policy. Current user input/approved parameters are user-role data; prior user messages are explicitly untrusted context; retrieved results use tool-role messages tagged untrusted. Tool/source/history text cannot change the system policy, tools, owner identity, URLs, permission or execution bounds. Unknown tools and malformed arguments are rejected even when requested by injected text. Server-enforced assumption approval and selectable-field validation do not depend on the model obeying the prompt.

Migration **`0008_massive_jocasta.sql`**, with generated Drizzle snapshot/journal, adds only private `assistant_conversations` and `assistant_turns`. Both link to Auth owners; turns have an owner-qualified conversation foreign key. RLS permits owner reads; direct authenticated/anonymous mutation is revoked. Narrow `begin_assistant_turn` / `finish_assistant_turn` SECURITY DEFINER RPCs derive the owner from `auth.uid()`, fix their search path, and touch only these two history tables—never operational records. Anonymous execution is revoked. Auth account erasure cascades to history.

Admission takes a transaction-scoped per-owner advisory lock, validates the owned conversation, enforces quotas, and inserts the turn before any model request. Failed/provider-disabled requests still consume admission. Completion locks the owner-filtered turn and writes once; another owner receives null, and a completed result cannot be overwritten. No raw provider bodies, stack traces or credentials are persisted in failures. A terminated request can leave a visible unfinished turn; no background inference/resume is implied.

**History integrity boundary:** an authenticated owner can call the completion RPC directly and finalize their own unfinished turn with bounded arbitrary JSON. Stored responses are consequently **untrusted owner-scoped history, not authoritative calculation replay**. Current orchestration reads at most four prior user messages, never stored response content, approvals, calculations or provider tool calls. Every new factual finding requires new authorized tool evidence. A future history display/replay API must label this boundary or add trusted server attestation before claiming verified stored outputs. This does not bypass another user's ownership or publish private data.

### Execution and resource limits

| Resource | Bound |
| --- | --- |
| Request | 16 KiB streamed JSON; message 1–8,000 trimmed characters; body consumption deadline-bound |
| Model orchestration | At most 4 rounds, 6 total tool calls, no duplicate identical calls; unknown/malformed calls still consume the call budget |
| Tokens/context | At most 1,400 generated tokens/round (5,600 total); 96,000 UTF-8 serialized input bytes/round and 240,000 cumulative including system/tool schemas/history, a conservative byte-based token ceiling rather than an inaccurate characters/4 estimate |
| Provider transport | Fixed HTTPS host; no redirects/cache; 12-second attempt timeout, max 2 attempts for transient network/5xx/timeout failures; small exponential jittered backoff; shared 45-second inference deadline |
| Provider errors | 401/403/other rejection, invalid/truncated/oversized output and 429 are not blindly retried; sanitized errors only; full Retry-After seconds/date retained in error metadata rather than shortened to fit a request |
| Provider/model payload | 64 KiB provider response, 16,000-character tool arguments, strict model-turn/final-selection Zod schemas |
| Tool evidence | 32 KiB individual result, 96 KiB aggregate evidence envelope, 16 KiB aggregate proposed approvals; oversize is explicit unavailable/limit failure, never silently truncated calculation evidence |
| Storage transport | Separate user tool client expires with the 45-second inference deadline; persistence client reserves up to 55 seconds overall; each Supabase fetch max 5 seconds. Abort propagates to outstanding model/tool awaits; previous evidence remains saveable after tool cancellation |
| History/storage | At most 4 previous user messages in context; 100 conversations/owner, 200 turns/conversation; message DB byte/character checks and response JSON object cap 256 KiB |
| Request frequency | Transactionally serialized per owner: 6 admissions/minute and 30/rolling 24 hours, across application instances; provider/key quotas are separate and can be lower |

Normal outcomes—including degraded provider states and tool errors—return HTTP 200 with structured status/error codes and collected evidence. Invalid/query/oversized input returns 400, unverified identity 401, stalled body deadline 408, missing/inaccessible conversation 404, conversation-cap conflict 409, admission quota 429 with a minimum 60-second Retry-After, and required storage/authorization infrastructure failure 503. Responses are no-store. Daily quota exhaustion can outlast that retry interval; the header is not a promise of admission. Tool/provider error details remain sanitized and distinguish missing evidence, required approval, limits, not-found, conflicts, unavailable/disabled inference, rate limiting and malformed output.

If inference fails after tools run, the response preserves verified current-request calculations/source metadata and omits unsupported recommendations. Without inference configuration, it returns a safe degraded result; existing routing, forecasting and scenario APIs remain fully usable directly. No deterministic service imports provider configuration or requires a successful LLM call. Large domain results can be accessed through their original APIs instead of loosening assistant limits.

### Verification and remaining activation gates

Local results on the session's 2026-11-07 task date:

| Check | Observed result |
| --- | --- |
| `pnpm -r --if-present test` | **177 passed, 7 skipped**: shared 9, db 10, backend 140, web 18; skipped = 6 existing public-provider live cases + 1 OpenRouter live case |
| `pnpm exec turbo run lint --force` | PASS; existing web/API ESLint scope |
| `pnpm build` | PASS; `/api/v1/assistant/chat` included; existing frontend and all prior backend routes preserved |
| Post-build `pnpm exec turbo run typecheck --force` | PASS across all four typed packages |
| `pnpm --filter @altair/db db:generate` | No further schema changes after offline migration generation |
| `git diff --check` | PASS for tracked changes; pre-existing Windows LF/CRLF warnings only; new assistant files inspected in independent review |
| Ignored local configuration / browser marker scan | Both environment files ignored; no OpenRouter credential markers in browser JavaScript |
| Opt-in live OpenRouter command | **SKIPPED / BLOCKED: no local key**; no inference request was sent, no free-model availability/reliability claim |

Tests cover mocked structured provider turns, malformed/unknown/oversized tool requests, forged ownership/records/references, missing/null evidence, unavailable providers, authentication failures, retries, Retry-After, timeouts, truncated/oversized output, paid/foreign-host rejection, round/call/context guards, prompt injection, inappropriate recommendations, and blocked unapproved numerical assumptions. Real PGlite/PostgreSQL executes migration/RLS/owner RPCs/quota/write-once completion for two identities. A mock-model integration uses actual owner-authorized PostgreSQL snapshots, existing route/forecast/simulation handlers and persisted scenarios, then proves cross-owner 404 behavior and direct operation without an LLM. Actual Next.js wiring tests verify positive mock-provider inventory dispatch, owner filtering, private completion and separate tool/persistence transports, not just anonymous rejection.

Independent read-only review identified three correctness gaps: model-invented numerical assumptions, arbitrary source-text findings, and tools consuming persistence reserve. All were reproduced with failing regressions and fixed; the full suite/build/types above were rerun afterward. The review's missing positive web/cancellation coverage was also added. Native simultaneous multi-connection admission remains **unverified** because PGlite serializes one connection; advisory-lock logic and sequential quotas execute, not a production contention/load claim. Stored-response integrity is explicitly limited as documented above, not silently presented as verified replay.

To run the retained synthetic-only free-provider check after supplying a rotated key locally:

```powershell
$env:ALTAIR_LIVE_LLM = '1'
pnpm --filter @altair/backend exec vitest run test/assistant-live.test.ts --reporter=verbose
```

This flag is separate from `ALTAIR_LIVE_PROVIDERS`; neither silently enables the other. The live check must actually pass tool calling, server argument validation, evidence return and final structured selection before operational provider reliability can be asserted. Free quotas, routing/model availability, provider retention/privacy terms and permissions to send authorized private operational data must be reviewed before enabling for real users.

Migration 0008 was applied **only to disposable local PostgreSQL**. No remote Supabase database, production data, Cron/publication configuration, deployment, paid provider, commit or push was changed. Real activation requires separately authorized migration review/application, a rotated local/server key, the live synthetic test, two real deployed Auth identities, native quota concurrency/resource tests and a retention/history-integrity policy for any future history UI. Frontend code was intentionally left unchanged. Task 007 stops after this specification update.
