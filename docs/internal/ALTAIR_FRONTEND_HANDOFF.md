# ALTAIR Frontend Integration Handoff

Internal · Task 010 local integration foundation, 2026-11-07. No frontend-owned pages, components or styling were changed. Earlier Task 009A/009B notes below are historical where superseded by section 8.

Start with [API Reference](ALTAIR_API_REFERENCE.md); consult [Backend Guide](ALTAIR_BACKEND_GUIDE.md) for calculations and [System Status](ALTAIR_SYSTEM_STATUS.md) for verification/activation gates.

## 1. First decisions and prerequisites

The backend services exist, but **none of the seven operational screens exists in this checkout**. `apps/web/app/page.tsx` is a placeholder. Screen names below are integration targets, not claims of shipped frontend behavior. The complete shipment → route → simulation → stock → supplier → AI workflow is supported by separate services and local integration tests, **not a verified deployed all-screen journey**.

Before wiring screens:

1. **Agree on Auth bootstrap.** Backend handlers verify Supabase SSR cookies with `auth.getUser()`; Task 010 adds `apps/web/middleware.ts` to refresh session cookies on both downstream request and browser response. There is still no frontend browser client/sign-in page/callback. Establish one reviewed cookie-compatible sign-in flow; a localStorage-only token or arbitrary bearer header will not authenticate these handlers. Only the project publishable key may reach a browser; database/provider/ingestion credentials never do.
2. **Use the new narrow selectors.** `GET /api/v1/products`, `/locations`, `/warehouses`, `/shipments` and `GET /shipments/{id}` supply catalog UUIDs/owner records; `POST /warehouses`, `/shipments` create owned declarations. No separate connections listing, catalog write, inventory movement/order list, or supplier booking API exists. Do not import `@altair/db` or `@altair/backend` into a client component.
3. **Review migration activation separately.** All nine migrations pass disposable PostgreSQL tests; the remote migration ledger was not inspected or changed. A real application must have the intended migrations/policies/RPCs applied through authorized operations first.
4. **Separate demonstration and production evidence.** The Qatar route fixture has simulated services/prices/time/coordinates and is not seeded automatically. Public data ingestion defaults to historical cereals, not essential equipment or a transport service graph. No verified operational equipment route/supplier directory is bundled.
5. **Use versioned contracts.** Import `@altair/shared/contracts`; use `z.input<typeof schema>` for default-bearing form requests and the output schema for results. Legacy `Shipment`, `Inventory`, `Alert`, `Scenario`, `locationSchema` are not substitutes for the newer wire contracts. Several list/config envelopes are handler-local; agree on a shared addition before relying on handwritten types across teams.

**Task 009A correction:** the CLI import failure is fixed by declaring `packages/shared/src/contracts/` an ESM package boundary without changing the legacy shared root export. A Node22 child-process regression exercises unknown job and missing database configuration. `pnpm --filter @altair/backend ingest weather` with an intentionally invalid database URL exits cleanly with sanitized `ingestion_unavailable`; this does **not** mean an actual target was ingested or an AIS worker is running.

Relevant current Supabase SSR cookie behavior was checked against `/supabase/ssr/v0.12.7` documentation via Context7. This confirms integration mechanics, **not** that a login/refresh/callback flow is already present or deployed.

### Concrete same-origin usage (after the teammate implements cookie-compatible sign-in)

Use `fetch('/api/v1/...', { credentials: 'same-origin' })`; do not send `INGESTION_SECRET`, `DATABASE_URL` or a bearer token from a client component. Handle `!response.ok` before parsing a successful response schema. For example, after obtaining **real** catalog UUIDs through an agreed authenticated projection:

```ts
import { routeComparisonSchema, routeRequestSchema } from '@altair/shared/contracts'

const request = routeRequestSchema.parse({ originId, destinationId })
const response = await fetch('/api/v1/routes/compare', {
  method: 'POST', credentials: 'same-origin',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(request),
})
if (!response.ok) throw new Error(`Route comparison unavailable (${response.status})`)
const comparison = routeComparisonSchema.parse(await response.json())
// 200 may contain zero alternatives; unknown cost/duration remains null.
```

For scenarios, send `scenarioInputSchema` as JSON to `POST /api/v1/scenarios` (201 `scenarioRecordSchema`), then `POST /api/v1/scenarios/${id}/execute` **with no body** (200 `simulationOutputSchema`), then `GET /api/v1/scenarios/${id}/compare` for verified replay. GET list returns `{data:[{id,name,createdAt,engineVersion,executed}],meta:{nextCursor}}`, whereas GET alerts returns `{data:AlertRecord[],nextCursor}` and GET inventory returns `{version,data,nextCursor}`. Monitoring evaluate is the exception that **requires** an explicit JSON `{}` body. A 401 means there is no verified cookie session, not that the browser should retry with an ingestion secret. Never call `/api/internal/*` from the browser.

## 2. Screen-to-backend matrix

Status uses Working / Partially Working / Requires Configuration / Not Implemented. “Working” is local backend evidence only; every screen's UI itself is Not Implemented in the audited checkout.

| Frontend screen | Required backend capability | Actual API / contract | UI behavior | Verified backend status |
|---|---|---|---|---|
| Command Center | Risks, owner alerts/stock, ingestion health | GET `/api/v1/risks`, `/alerts`, `/inventory`, `/shipments`, `/freshness`, `/ingestion/status`; contracts `risksResponseSchema`, `alertRecordSchema` in list envelope, `inventoryListResponseSchema`, `shipmentListSchema`, freshness/status schemas | Separate operational declarations from provider status; show incidents/alerts and honest partial coverage | **Partially Working:** component APIs pass; no aggregate operational-summary/KPI endpoint or total counts |
| Route Intelligence | Directed route/cost/time/risk comparison | POST `/api/v1/routes/compare`; `routeRequestSchema` → `routeComparisonSchema` | Shipment requirements, priorities, alternatives, evidence/condition cards and available map geometry | **Working** locally; production network/data must be curated; enrichment **Requires Configuration** |
| Crisis Command | Targeted intelligence, private deterministic twin | GET `/api/v1/risks`; scenarios POST/GET, GET `/{id}`, POST `/{id}/execute`, GET `/{id}/compare` | Scenario builder, immutable baseline, explicit assumptions, compare result | **Working** locally; external geopolitical coverage partial; no scenario edit/delete API |
| Inventory | Stock mutations, reservations/orders, forecast and scenario overlays | GET/POST `/api/v1/warehouses`, GET `/products`, GET/POST `/shipments`, GET/POST `/inventory`, PATCH `/{id}`, POST `/movements`, POST `/orders`, PATCH `/orders/{id}`, PATCH `/replenishments/{id}`, POST `/api/v1/forecasts` | Stock rows, explicit history/units/lead assumptions, predictions/lower bounds, receipt review | **Working** locally; full management still lacks movement/order list APIs |
| Suppliers | Evidence-based catalog matches and observed import dependencies | POST `/api/v1/suppliers/search`, `/api/v1/import-dependencies` | Product/edition/capability filters, potential-vs-confirmed catalog cards, source links, dependency charts | **Working** on curated fixtures; no connected external supplier directory/current stock/ordering |
| Tracking | Public network observations, owner monitoring and alert lifecycle | GET `/api/v1/observations`, `/freshness`; GET/PUT `/monitoring/config`, POST `/monitoring/evaluate`, GET `/alerts`, PATCH `/alerts/{id}` | Evidence-only positions/road status, timestamp/freshness labels, explicit mappings and alert actions | **Requires Configuration** for live network feeds; **Working** local monitoring; actual cargo/provider tracking **Not Implemented** |
| AI Assistant | Bounded tool-driven explanation / assumption approval | POST `/api/v1/assistant/chat`; `assistantRequestSchema` → `assistantResponseSchema` | Nonstreaming chat, evidence/uncertainty cards, review pending inputs, degraded result states | **Requires Configuration:** mock-model pipeline passes; key absent/live inference unverified; no history read API |

No route exists under `/api/v1/dashboard`, `/tracking`, `/assistant/history` or `/connections`. These are gap labels, **not callable endpoints**. Do not derive API URLs from table names or product screen names.

## 3. Integration behavior by screen

### Command Center

1. **Load:** request risks, alerts, inventory and provider freshness/status independently after sign-in. Paginate each using its actual cursor location; do not treat the first page as a global total.
2. **Actions:** incident selection uses risk target/evidence; alert acknowledge/resolve calls PATCH alerts/{id}; refresh triggers authorized reads, not internal ingestion. Offer monitored re-evaluation only as an explicit user action.
3. **Returns/display:** risk coverage and evidence, alert states/counters/actions, owner-maintained quantity and units, per-job freshness/retry. KPIs must disclose scope (e.g. “loaded open alerts”), not invent a complete shipment summary or national risk score.
4. **States:** maintain independent loading/error indicators. A provider failure must not blank valid owner stock. Empty alerts are “no alerts returned,” not “all logistics safe”; zero risks with unmapped evidence is incomplete coverage. 503 storage failure differs from 200 unavailable data.
5. **Ownership:** all users may read shared reference evidence; stock/alerts are private per user. Clear private caches/subscriptions on sign-out or account switch; never use a global cache key for user data.
6. **Missing:** no aggregate summary, counts, shipment list, incident detail REST endpoint or push channel. Component aggregation is possible within visible pages; backend aggregate contracts require agreement, not frontend invention.

### Route Intelligence

1. **Load:** GET locations (countryCode=QA for destination) and products; optionally GET owned shipments. Optional GET risks/freshness provides context; it is not a substitute network catalog. POST shipments persists declared requirements separately from route comparison.
2. **Actions:** compare submission calls POST routes/compare. Recalculate on deliberate priority/constraint changes; cancel/supersede obsolete read-only requests. Hypothetical/enrichment toggles need explicit user intent and relevant server activation.
3. **Returns/display:** ordered alternatives; complete same-currency totals versus subtotals; full/known partial duration; risk index and factors; feasible/conditional reasons; confidence/source/nature; Pareto and score explanations; coverage.truncated. Lower score is better, not probability or financial savings. Draw only GeoJSON features and expose geometryGaps. Keep provider navigation estimates separate from freight/service evidence.
4. **States:** compare button loading and validation errors; 400 unknown_location means invalid/missing catalog selection. 200 no_feasible_path is a legitimate no-alternative state with rejection reasons. Null cost/time is “unknown,” never zero/free/instant. A disabled optional enrichment provider should not hide a valid deterministic comparison.
5. **Ownership:** comparison reads shared catalogs under the verified user. It neither saves a private route option nor updates shipments. Do not send ownerId/network in the body.
6. **Missing:** connection listing/operational network population and verification, booking/quotes/live schedules. For demos use `packages/backend/src/routing/demo.ts` in isolated fixtures only, with conspicuous hypothetical labeling.

### Crisis Command

1. **Load:** GET risks and paginated scenarios. On selection GET scenarios/{id} for immutable input/snapshot; use GET compare for verified executed output, not the detail output alone.
2. **Actions:** user creates a new strict scenario with existing route request and known target UUIDs. Then POST execute **without `{}` or any other body**. Fetch compare after success. Editing assumptions means creating another scenario; no PATCH exists. Retry an uncertain create only after reconciliation with existing records/user confirmation; there is no create idempotency key.
3. **Returns/display:** fixed evaluation time/engine/hash/reference, baseline versus simulated alternatives and product/unit supply, preferred comparable deltas, changed reasons and assumptions. Label both comparisons as scenario context, not a new carrier ETA. Show conditional/lost-returned routes, not universal network claims.
4. **States:** 409 scenario_not_executed offers execution; unsupported version/integrity conflict requires review, not local recomputation over current data. Empty disconnected results remain successful calculations. Null supply needs explicit stock/demand/receipt data. SQL target errors can be400 and other storage failures503; not every creation failure guarantees no record was stored.
5. **Ownership:** another user's ID is indistinguishable from missing404. Snapshot includes only caller-visible private stock/shipments. Never clone another user's local cached snapshot into the request.
6. **Missing:** scenario rename/edit/delete REST, global geopolitical write API and automatic supplier substitution. Scenario forecasts require a matching current baseline; handle409 scenario_baseline_changed by capturing a new scenario, not reusing stale overlays.

### Inventory

1. **Load:** GET inventory with optional product/warehouse filters. GET products and owned warehouses/shipments for labels and references. There is no inventory-detail GET, movement-list or order-list API; current-order editing/history cannot be fully reconstructed from the stock list or forecast output.
2. **Actions:** create stock in an owned warehouse; PATCH only total reservation/historyStart; record physical consumption/receipts via immutable POST movements with a stable idempotency key. Create/replace declared orders with the complete order schema. Link/update an existing shipment via PATCH replenishments/{**shipmentId**}. Forecast submit sends explicit demand/history/lead/coverage/safety assumptions; scenario selection adds owned scenarioId.
3. **Returns/display:** record responses are unwrapped; list has version/data/nextCursor. Forecast displays physical-vs-free stock distinctly, mean/history/trend/uncertainty, dated projection, uncovered commitments, eligible/unknown receipts, shortage-before-lead and suggested purchase/time. `commitments_only_lower_bound` is not a full demand forecast. Negative projection is unmet demand, not physical stock below zero.
4. **States:** enforce 3-decimal stock/movement/order strings and exact units; shipment quantities allow6. Do not turn null lead time into0. On duplicate movement400, do not retry with a new key. Use the same key to avoid a double application after a lost response. Unknown-demand/no-stockout is not “safe”; a nullable threshold date is limited by horizon. Refetch stock after movement and recalculate affected forecasts. Scenario-baseline409 needs a fresh scenario.
5. **Ownership:** stock references an owned warehouse; orders/movements/replenishments enforce the same owner. Inaccessible forecasts/updates return404, while invalid create FKs can return400. Supplier confirmations here are private owner assertions, not shared catalog verification.
6. **Missing:** product/catalog creation (trusted-only), full order/history editing lists, automated receipts/reservation release/purchasing. Completing/cancelling an order alone must not pretend stock moved. Import history only with correct opening balance and explicit complete-history date.

### Suppliers

1. **Load:** POST suppliers/search with actual product/HS-edition/country/capability filters; POST import-dependencies only when reporter/HS/edition/currency inputs match existing ingested evidence. For relevant source details use GET trade (whose data includes classification/dependency as well as trade).
2. **Actions:** filter/page search; inspect evidence; optionally compare dependency exposure under an owned scenario. “Contact/verify supplier” is a review action, not an API that places an order. Selection must not automatically credit stock or a receipt.
3. **Returns/display:** confirmed_catalog_match versus potential_match, catalog verification reasons, source dates/link/license where present, score-as-index and **availability unverified for all matches**. HHI/top/effective/exposed shares refer to the observed historical value denominator; display period, currency, classification and coverage caveats, never a national shortage probability.
4. **States:** empty search suggests refining criteria/curating catalog, not unavailable national supply. No-data periods/null HHI remain unknown. 409 select_single_trade_provider needs explicit provider selection; never sum duplicate providers. Fresh sync may still describe2024. Default Comtrade World totals are unusable for country concentration; default Qatar HS10 is not equipment coverage.
5. **Ownership:** directory evidence is shared authenticated reference; no private supplier orders/availability is exposed. A scenario must belong to the caller. Country-code mappings are explicit user assumptions.
6. **Missing:** external supplier discovery/stock API, quotation/order/procurement endpoint, fuzzy matching, unit substitution or automatic exclusion of scenario-unavailable supplier IDs. If comparing alternatives to a simulated supplier failure, visibly retain that scenario context and identify/exclude the failed candidate in presentation; do not claim search executed a scenario-aware substitution.

### Tracking

1. **Load:** GET observations by job with all relevant pages, plus freshness/status; GET monitoring config and owner alerts. Choose latest per provider/job/providerId using event time rather than UUID order. Re-poll a complete bounded current view as needed—new UUIDs are not guaranteed later than a previously saved cursor. No live observation subscription exists.
2. **Actions:** save full monitoring config with explicit edge mappings and baseline assumptions; user refresh evaluation POST `{}`; PATCH alert acknowledgment/resolution. Internal ingestion/monitoring endpoints are **never frontend calls**.
3. **Returns/display:** public aircraft/vessel points/road status, event time/sync time/event freshness/attribution, evidenceOnly label. Show shipment records as separate owner/carrier declarations if the agreed private projection exists. No line/icon should imply broadcast-to-cargo association. Alert cards expose action/evidence/state/occurrence/notification count and forecasting limitations.
4. **States:** initially disabled/unconfigured feeds are normal, not empty working trackers. Gray/label stale positions; a successful sync cannot make an old event fresh. Retain last-good data with failure label. Mapping/config400 needs correction; evaluation409 needs fresh snapshot/retry. Missing evidence does not clear an existing alert; let owners review/resolve it explicitly.
5. **Ownership:** observations are shared evidence; monitoring/config/alerts private per Auth user. Optional authorized Realtime alerts use INSERT/UPDATE with caller session and owner filter, then refetch GET alerts; remove subscriptions on sign-out. Deduplicate toasts by `(id,occurrence,notificationCount)`. Do not subscribe to DELETE.
6. **Missing:** activated/licensed network feeds, carrier-specific shipment provider/webhook, true cargo positions, continuous AIS daemon, browser observation stream, camera display endpoint and activated Realtime publication. AIS requires an approved non-Vercel worker; five-minute polling can leave120-second aircraft events stale.

### AI Assistant

1. **Load:** no history GET exists. Keep current-session view locally and preserve returned conversationId only for that owner. Auth/storage must work even when LLM is disabled; checking only for a configured key is insufficient.
2. **Actions:** POST assistant/chat, wait for nonstreaming JSON; review pendingToolRequests and resubmit exact approved inputs. Simulation creation requires separate explicit allowSimulationCreation consent. Numerical demand, lead time, route constraints and import assumptions must be reviewed, not silently accepted from the model.
3. **Returns/display:** status/task, server-authored finding explanations with exact scalar values, safe review recommendations, expandable tool result/evidence/source/parameters/parameterAuthority/freshness/limitations. Labels fact/estimate/prediction/hypothetical indicate evidence category, not certainty. Link findings to evidenceId+JSON pointer from the **same request**. Show raw source strings as untrusted text, never HTML or an instruction.
4. **States:** treat200 degraded as an explicit partial/unavailable state; llm_disabled should offer direct domain screens. Keep successful evidence if a later model call fails. Render clarification or approval requests without fabricating a recommendation. Respect429 Retry-After and provider retryAfterSeconds; daily quota may last longer than60 seconds. Request cancellation/uncertain response may still consume a turn/quota; do not auto-resend indefinitely.
5. **Ownership:** conversations/scenarios/stock/shipments are owner-scoped. Clear chat on account switch. History is not attested calculation replay; completion RPC accepts bounded owner content, and new findings always need fresh tools. Review private-data transfer/privacy terms before enabling external inference.
6. **Missing:** rotated server key/live free-model tool verification, history REST/replay guarantees, SSE, arbitrary tool execution, booking or procurement. A single request has at most6 calls/4 model rounds and32KiB per-tool result; the whole workflow may need several explicit domain actions rather than one giant “do everything” chat request.

## 4. Shared UI rules that prevent contract bugs

| Condition | Required behavior |
|---|---|
| Before Auth / 401 | Sign-in state; preserve safe form input; no private cached result visible to another user. |
| 400 | Display validated input/constraint correction; do not relabel as no-data or provider outage. Server errors are sanitized, not field-by-field Zod issues. |
| 404 owned resource | “Not available to this account or missing”; never disclose cross-owner existence. |
| 409 | Handle endpoint-specific conflict: execute first, new scenario baseline, provider selection, or new monitoring evaluation. |
| 429 | Back off; distinguish assistant admission from provider errors inside a200 result and internal-only deferred ingestion. |
| 503 | Storage/configuration/service unavailable; keep previous result explicitly timestamped, do not synthesize success. |
| 200 + empty/null/unknown | Legitimate bounded no-data/no-route/unknown calculation state; preserve reasons, units and scope. |
| Fresh / historical / estimated / simulated | Display **both** synchronization freshness and nature/reporting period; one does not replace the other. |
| Missing/mixed costs | No total/savings/FX comparison; show known per-currency subtotals and missing components. |
| Concurrent UI requests | Abort/supersede older reads; key state by user+input+scenario; never let an old response overwrite a newer selection. |
| Mutations | Guard duplicate submits; refetch affected records; abort does not roll back server state. Only movements have a client idempotency key, and duplicates return400. |
| Pagination | Read nextCursor from the correct envelope, stop at null; no hidden total/newest-order assumption. |

## 5. Efficient integration roadmap

This is an integration order, **not authorization to add backend features or change architecture**. Resolve contract decisions with the backend owner and preserve concurrent work. Each stage can be accepted independently.

| Stage / screens | Endpoints and dependencies | Acceptance criteria | Test scenarios / current blockers |
|---|---|---|---|
| **0. Session and selectable records** — all screens | Cookie server Auth + refresh middleware; GET products/locations/warehouses/shipments/health/freshness; POST owned warehouse/shipment | Two actual users sign in, protected reads work, switch/sign-out clears private state; owned UUIDs/catalog IDs available without hardcoding fixture IDs | Missing/expired cookies, refresh, cross-owner ID, network failure. **Blockers:** frontend sign-in/browser client/callback; remote migrations/Auth and curated catalog unverified. |
| **1. Shipment requirement → route comparison** — Route Intelligence | POST routes/compare; curated graph, unit/handling/quantity/priority form | Qatar destination selected; feasible/conditional/no-route results render; costs/time/risk/nature/search limits honest; no fake geometry | Directed/disconnected network, stale evidence, missing/mixed cost, hard ceilings, unavailable enrichment, simultaneous changed-priority requests. **Blocker:** no verified operational equipment network; use isolated explicit demo or curate authorized data. Shipment persistence remains separate. |
| **2. Hypothetical disruption → replay** — Crisis Command | Scenarios POST → POST execute (empty body) → GET compare; GET risks/list/detail | Closure/cost/time change produces deterministic baseline comparison; no stock/network mutation; only owner can read/run | Invalid/duplicate target, capacity0, no-path, compare-before-execute409, replay after live catalog change, overlapping execute, other-user404. Local tests pass; native concurrent DB/deployed sessions unverified. |
| **3. Inventory consequences** — Inventory + Crisis Command | GET/POST/PATCH inventory; POST movements/orders; PATCH existing replenishment; POST forecasts optionally scenarioId | Correct free stock/reservations/orders/eligible receipts; explicit demand/lead assumptions; shortage/purchase/unknown states; simulate without operational mutation | Unknown history/lead/verification, stale receipt, mismatched unit, duplicate movement, lost response, scenario-baseline409, route-delayed receipt. **Blockers:** existing owner stock/warehouse/shipment bootstrap, no movement/order list contract. |
| **4. Supplier alternatives / import context** — Suppliers | POST suppliers/search, POST import-dependencies, GET trade; trusted product/capability/evidence, actual HS scope | Relevant potential/confirmed catalog candidates with unverified availability; observed-origin dependency sources/periods clear; no procurement | Stale/inferred supplier, classification mismatch, empty directory, ambiguous provider409, World-only/no origins, missing mapping, stale sync. **Blockers:** curated equipment supplier evidence and matching trade scope; no current stock provider. |
| **5. Explain verified trade-offs** — AI Assistant | POST assistant/chat plus already functioning stages1–4; rotated local/server free-model configuration and reviewed privacy | Explicit approvals gate assumptions; findings point to current tool evidence; recommendations degrade safely when inference unavailable; direct domain results remain usable | Unknown tool/prompt injection, forbidden owner ID, unapproved demand, model error/429, large evidence, quota/cancellation, cross-owner404. **Blocker:** key absent/live LLM not verified; do not gate deterministic workflow on AI. |
| **6. Operational overview / monitoring** — Command Center + Tracking | Component reads, GET/PUT config → POST evaluate → GET/PATCH alerts; optional approved Realtime; separately approved feeds/Cron | Explicit route mappings, repeat suppression, acknowledge/escalate/recur behavior, event-vs-sync freshness; reconnect refetch | Provider outage, stale/old road closure, unknown cost, config change during evaluation409, terminal shipment/manual resolution, multi-user isolation. **Blockers:** licensed feed activation, deployment schedules/publication and real WebSocket/native load tests; no cargo tracking. CLI import now works locally, but no AIS worker or live ingestion was activated. |

### Complete-workflow acceptance boundary

For an honest end-to-end demonstration, use an authorized **isolated** dataset with a Qatar destination, declared equipment product/unit, explicit graph evidence, owned stock/history/order/shipment quantities/verification, relevant supplier evidence and transparent scenario assumptions. Run stages1–5, inspect hashes and stored-vs-operational separation, and label every simulated record. `packages/backend/test/assistant-pipeline.test.ts` now exercises one connected **HYPOTHETICAL** Qatar equipment path: authenticated-role fixture identity and stock → route comparison → snapshot-backed closure and stock reduction → verified replay showing a shortage → catalog supplier match with availability **unverified** → bounded mock-model evidence/recommendation. It uses disposable PGlite/PostgreSQL and a scripted model, **not** a real Supabase cookie, shipment creation, external supplier availability, a live LLM, or a deployed end-to-end screen. Other tests cover shipment/monitoring and trade separately; no single test proves all live external steps.

For production acceptance additionally verify two real deployed identities, actual migration/RLS/RPC installation, approved live data scope/credentials/licenses, native simultaneous transactions, deployment runtime limits, Cron HTTP delivery and optional alert Realtime. Current unit/fixture/loopback passes cannot replace those checks.

## 6. Contract changes requiring coordination

- Add/select catalog and private record projections only after both teams agree on ownership, exact fields and exposure. Table existence is not a stable frontend contract.
- Resolve legacy `locationSchema` terminal/coordinates mismatch and old ownerId/numeric schemas by using actual endpoint schemas now; do not silently rewrite another developer's types.
- If adding shared wrappers later, cover scenario summary/list, alerts list, config envelope, evaluation+persistence and health. Existing APIs return different cursor positions; a generic API wrapper must preserve them.
- Do not add unrequested simulated fallback into production adapters, or change unavailable/missing totals to zero to simplify display.
- Task 009A changed only the shared-contract module boundary, CLI regression test, Node/CI configuration and internal documentation; no frontend-owned files, wire schema shapes, migrations, schedules or provider/model choices were changed. Coordinate future contract additions with the frontend owner.

## 7. Task 009B connection decisions

At Task 009B there were 28 paths/31 explicit methods; Task 010 adds five paths/seven explicit methods (33/38 total). The [API Reference](ALTAIR_API_REFERENCE.md) still documents the original 31 in detail; section 8 below is the additive Task 010 contract. All `/api/v1` operations except public health use verified SSR cookie identity; internal POSTs use the server-only scheduler secret. **Realtime is optional for alerts only**; all other screens poll/refetch. A 200 degraded assistant response is not an AI recommendation, and a 200 empty route/stock/source result is not an outage.

**Task 009B historical note:** before Task 010, catalog/warehouse selectors and shipment create/list were absent. They are now implemented as specified in section 8. Still missing are frontend sign-in/callback, movement/order list, aggregate dashboard KPIs, live carrier tracking and AI history. Do not hardcode demo UUIDs or read private tables with a service key.

**Task 009B proof limits:** that test lacked a shipment create. Task 010's additive disposable-DB test now creates an owned shipment and covers the monitoring stockout alert under two shimmed identities; it still does not prove real browser cookie refresh, native parallel DB connections, externally curated operational availability or provider quotas. Require a real two-user staging run after integration review; cross-owner reads must be absent/404 and private caches cleared at sign-out.

## 8. Task 010 additive integration contract and frontend checklist

**New routes (all same-origin, verified Supabase cookie, `Cache-Control: no-store`; never send scheduler credentials):**

| Method/path | Input | Response | Failure/availability |
|---|---|---|---|
| GET `/api/v1/locations` | `selectionQuerySchema`: `limit=50` (1–100), `cursor?` UUID, `countryCode?` exactly 2 characters | `locationListSchema`: `{data:[{id,name,kind,countryCode,coordinates:[longitude,latitude]\|null}],nextCursor}` | 400 bad/duplicate query, 401 no verified identity, 503 storage failure. Catalog may be empty; no real service implied by a location. |
| GET `/api/v1/products` | `ownerSelectionQuerySchema`: `limit=50`, `cursor?`; no country filter | `productListSchema`: `{data:[{id,name,hsCode:string\|null}],nextCursor}` | Same errors; HS code alone does not verify edition or supplier coverage. |
| GET `/api/v1/warehouses` | `ownerSelectionQuerySchema` | `warehouseListSchema`: `{data:[{id,name,locationId:UUID\|null}],nextCursor}` | Owner-only rows; empty for new user. |
| POST `/api/v1/warehouses` | `warehouseWriteSchema`: `{name,locationId?:UUID\|null}`; name 1–200 characters | 201 `warehouseSelectionSchema` (unwrapped) | 400 invalid body/FK, 401 unauthorized, 503 unavailable. Creates an owner declaration, not a public catalog. |
| GET `/api/v1/shipments` | `ownerSelectionQuerySchema` | `shipmentListSchema`: `{data:ShipmentRecord[],nextCursor}` | Owner-only; no total or chronological ordering (ascending UUID). |
| POST `/api/v1/shipments` | `shipmentWriteSchema`: `{productId,originId,destinationId,quantity,unit,supplierId?:UUID\|null,routeRequest?:RouteRequest\|null}`; distinct endpoints, positive decimal-string quantity ≤6 places, exact unit, optional route endpoints must match | 201 `shipmentRecordSchema` (unwrapped) | 400 invalid body/FK, 401 unauthorized, 503 unavailable. Owner comes only from verified Auth. Status starts `planned`; no booking, price, tracking or provider claim. |
| GET `/api/v1/shipments/{id}` | UUID path; no query | 200 `shipmentRecordSchema` | 400 malformed UUID/query, 401 unauthorized, 404 absent or other-owner, 503 unavailable. |

`shipmentRecordSchema` contains `{id,productId,originId,destinationId,supplierId,quantity,unit,routeRequest,inventoryId,confirmedQuantity,verifiedUntil,trackingNumber,status,estimatedArrival,updatedAt}`. Nullable fields are **null**, not fake values. `locationSelectionSchema`, `productSelectionSchema`, `warehouseSelectionSchema`, `warehouseWriteSchema`, `shipmentWriteSchema`, `shipmentRecordSchema`, and list/query schemas are exported from `@altair/shared/contracts` (`packages/shared/src/contracts/integration.ts`). Unknown keys/ownerId are rejected. All lists page by exclusive UUID cursor, maximum 100, with top-level nextCursor. Domain endpoints, filters, 400/401/404/409/429/503 semantics and nonstreaming assistant remain in [API Reference](ALTAIR_API_REFERENCE.md). Auth verification happens before reads/writes; no authenticated browser JWT Bearer shortcut exists.

**Hypothetical workflow request examples (replace every UUID with fetched, authorized IDs):**

```json
{"productId":"20000000-0000-4000-8000-000000000003","originId":"10000000-0000-4000-8000-000000000001","destinationId":"10000000-0000-4000-8000-000000000002","quantity":"40","unit":"kg","supplierId":null,"routeRequest":{"originId":"10000000-0000-4000-8000-000000000001","destinationId":"10000000-0000-4000-8000-000000000002","preferences":{"allowHypothetical":true}}}
```

POST `/api/v1/routes/compare` with the same validated routeRequest, then POST `/api/v1/scenarios` with `scenarioInputSchema` (owned inventory and explicit demand/modifications), POST `/api/v1/scenarios/{id}/execute` **without body**, GET `/{id}/compare`, and POST `/api/v1/forecasts` for the inventory ID. GET `/api/v1/inventory` returns `{version:"supply-1.0.0",data:[{id,productId,warehouseId,quantity:"100.000",reservedQuantity:"0.000",unit:"kg",historyStart:null}],nextCursor:null}` in this hypothetical case. POST `/api/v1/suppliers/search` with `{ "productId":"20000000-0000-4000-8000-000000000003", "countryCodes":["QA"] }` returns `supplierSearchResponseSchema`: `data` entries include `matchStatus`, `availability:"unverified"`, evidence, source time and limitations; never present as stock confirmation. For monitored stock, PUT `/api/v1/monitoring/config` with a forecast inventory target, POST `/api/v1/monitoring/evaluate` with `{}`, then GET `/api/v1/alerts` and optionally PATCH an alert ID. Risk reads use GET `/api/v1/risks`; simulated closures do **not** become public operational risk evidence.

**Frontend teammate:** implement a browser `createBrowserClient` using the project publishable key and same origin, an actual sign-in/sign-out UI and approved redirect/callback/PKCE flow, and clear private cached state and Realtime subscriptions on sign-out/account change. The backend `apps/web/middleware.ts` refreshes browser cookies into both request and response before protected requests; route handlers independently call `auth.getUser()` and RLS enforces owner scope. Treat expired/invalid cookies as sign-in state, service failure as 503; do not swallow 401 or retry writes on uncertain response. Validate input/output with the versioned schemas; render nulls as unavailable, historical/estimated/simulated nature separately from freshness and page scopes honestly. Use real fetched IDs, not test UUIDs. Never import backend/DB into client components or expose `DATABASE_URL`, `INGESTION_SECRET`, provider keys or Supabase secret key.

**Integration order:** agree shared-contract ownership before merging additive `integration.ts` and `index.ts` exports; land reviewed DB/auth/API code on an approved integration branch without overwriting teammate UI; integrate browser Auth; fetch products/locations/warehouses; create an owned warehouse and shipment; compare routes; create/execute/compare scenario; create stock/forecast; search supplier evidence; configure monitoring/evaluate/alerts; opt into AI only after privacy/model verification. Direct user-facing supplier, product or transport-catalog creation is deliberately absent (trusted curation required); movement/order history lists, carrier tracking and dashboard totals remain missing. A disposable test fixture in `packages/backend/test/integration-foundation.test.ts` seeds the **HYPOTHETICAL** Qatar graph, equipment, owner stock/shipment and supplier evidence only inside PGlite; it never seeds production.
