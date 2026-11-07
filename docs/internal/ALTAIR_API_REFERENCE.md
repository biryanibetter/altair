# ALTAIR API Reference

Private frontend integration reference · current working tree audited 2026-11-07.

**Authority:** executable schemas in `packages/shared/src/contracts/`, HTTP factories in `packages/backend/src/`, and actual wrappers under `apps/web/app/api/`. This document does not introduce APIs. All JSON examples below are **hypothetical**, schema-validated illustrations, not production IDs, seeded data, real quotes, availability or provider responses. Some examples describe separate hypothetical contexts and are not consecutive mutations of one database.

## 1. Authentication, transport and conventions

- Base: same origin as the Next.js application. Normal requests use the existing Supabase **cookie session**. `apps/web/lib/supabase/server.ts` uses `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` server variables, cookie `getAll/setAll`, and `auth.getUser()` verification. Normal APIs do not implement standalone `Authorization: Bearer <JWT>` parsing.
- Except health, `/api/v1` operations require verified Auth. Internal operations require `Bearer INGESTION_SECRET` (at least 32 UTF-8 bytes), **not** a user session. Never send that secret to the browser.
- JSON responses use `Cache-Control: no-store`. All explicit wrappers run Node, not Edge. Most calculation/mutation wrappers set `maxDuration=60`; this is a platform allowance, not an unconditional 60-second service guarantee.
- Send `Content-Type: application/json` for JSON mutations; handlers parse JSON bytes rather than enforcing a media-type contract. Domain bodies are at most 65,536 bytes; assistant bodies at most 16,384. Scenario execute has **no JSON body**, monitoring evaluate requires `{}`.
- New request objects are strict Zod schemas: unknown keys, caller owner IDs and arbitrary provider/network configuration are not allowed. Query duplicates are rejected on paginated reads. Status/freshness and most domain mutations reject query strings. **Exceptions:** routes/compare currently ignores query strings, and internal ingestion does not inspect body/query; do not rely on those omissions as extension points.
- UUIDs are real stored identifiers, not names, tracking numbers, or sample IDs. Units match exactly. UTC ISO timestamps use `Z`; amounts and operational quantities use decimal **strings**, not JSON money numbers.
- Normal resource errors are `{error:string}`. There is no global `{data:...}` envelope or generated API client. Parse the specific endpoint schema. No REST CORS policy/cross-origin credential integration is implemented; use same-origin fetch.
- General pagination is ascending UUID keyset (`id > cursor`), not chronological. Default/max limits differ below. Cursors are exclusive UUIDs, not encoded offset tokens. There are no total counts or configurable sort parameters; concurrent inserts mean multi-page reads are not one frozen snapshot.

## 2. Complete route / method inventory

Every path here corresponds to `apps/web/app` + the path + `/route.ts`, replacing `{id}`/`{job}` with Next.js `[id]`/`[job]`. There are **28 paths and 31 explicitly exported methods**. Implicit framework HEAD/OPTIONS handling is not a separate application contract.

Abbreviations: **U** = verified user cookie; **S** = scheduler Bearer; **P** = public. Schema names are exports from `@altair/shared/contracts`, unless marked handler-local.

| Method | Exact route | Auth | Request / query | Successful response |
|---|---|---|---|---|
| GET | `/api/v1/health` | P | none | 200 `{status:"ok",database:"connected"}` |
| GET | `/api/v1/trade` | U | `readQuerySchema`; job restricted below | 200 `readResponseSchema` |
| GET | `/api/v1/weather` | U | `readQuerySchema`; weather/marine | 200 `readResponseSchema` |
| GET | `/api/v1/observations` | U | `readQuerySchema`; transport jobs only | 200 `readResponseSchema` |
| GET | `/api/v1/ingestion/status` | U | no query | 200 `statusResponseSchema` |
| GET | `/api/v1/freshness` | U | no query | 200 `freshnessResponseSchema` |
| POST | `/api/v1/routes/compare` | U | `routeRequestSchema` | 200 `routeComparisonSchema` |
| GET | `/api/v1/risks` | U | `risksQuerySchema` | 200 `risksResponseSchema` |
| GET | `/api/v1/scenarios` | U | handler-local `{limit=20 (1..100),cursor?:UUID}` | 200 `{data:ScenarioSummary[],meta:{nextCursor:UUID|null}}` |
| POST | `/api/v1/scenarios` | U | `scenarioInputSchema` | 201 `scenarioRecordSchema`, output null |
| GET | `/api/v1/scenarios/{id}` | U | UUID path; no query | 200 `scenarioRecordSchema` |
| POST | `/api/v1/scenarios/{id}/execute` | U | UUID; **empty body only** | 200 `simulationOutputSchema` |
| GET | `/api/v1/scenarios/{id}/compare` | U | UUID; no query | 200 `simulationOutputSchema` |
| GET | `/api/v1/inventory` | U | `inventoryQuerySchema` | 200 `inventoryListResponseSchema` |
| POST | `/api/v1/inventory` | U | `inventoryWriteSchema` | 201 `inventoryRecordSchema` |
| PATCH | `/api/v1/inventory/{id}` | U | UUID + `inventoryPatchSchema` | 200 `inventoryRecordSchema` |
| POST | `/api/v1/inventory/movements` | U | `movementWriteSchema` | 201 `movementRecordSchema` |
| POST | `/api/v1/inventory/orders` | U | `orderWriteSchema` | 201 `orderRecordSchema` |
| PATCH | `/api/v1/inventory/orders/{id}` | U | UUID + **full** `orderWriteSchema` | 200 `orderRecordSchema` |
| PATCH | `/api/v1/inventory/replenishments/{id}` | U | existing **shipment** UUID + `replenishmentWriteSchema` | 200 `replenishmentRecordSchema` |
| POST | `/api/v1/forecasts` | U | `forecastRequestSchema` | 200 `forecastResponseSchema` |
| POST | `/api/v1/suppliers/search` | U | `supplierSearchSchema` | 200 `supplierSearchResponseSchema` |
| POST | `/api/v1/import-dependencies` | U | `importDependencyRequestSchema` | 200 `importDependencyResponseSchema` |
| GET | `/api/v1/monitoring/config` | U | none | 200 `{config: MonitoringConfig}` |
| PUT | `/api/v1/monitoring/config` | U | full `monitoringConfigSchema` | 200 `{config: MonitoringConfig}` |
| POST | `/api/v1/monitoring/evaluate` | U | strict `{}` | 200 `monitoringEvaluationSchema` fields + `{persistence:{changed:number}}` |
| GET | `/api/v1/alerts` | U | `alertQuerySchema` | 200 `{data:AlertRecord[],nextCursor:UUID|null}` |
| PATCH | `/api/v1/alerts/{id}` | U | UUID + `alertTransitionSchema` | 200 `alertRecordSchema` |
| POST | `/api/v1/assistant/chat` | U | `assistantRequestSchema` | 200 `assistantResponseSchema` (can be degraded) |
| POST | `/api/internal/ingestion/{job}` | S | allowlisted job; no required body | 200/409/429/503 `IngestionResult` |
| POST | `/api/internal/monitoring` | S | absent body or strict `{}`; no query | 200 or 503 `{evaluated,failed,changed}` |

### Queries and shared evidence shapes

| Endpoint | Permitted filtering / defaults | Output details |
|---|---|---|
| trade | `job?=qatar-imports\|qatar-dependencies\|comtrade`, limit default 50/max 100, cursor UUID | `data` includes **trade, dependency and classification** kinds, not just monetary rows. |
| weather | job weather/marine, same page parameters | Estimated provider model variables, nullable upstream values omitted. |
| observations | job opensky/here-flow/here-incidents/aisstream, same page parameters | Aircraft/vessel/traffic only; **no webcam/news read endpoint**. |
| risks | category weather/transportation/supplier/geopolitical; targetId UUID; freshness active(default)/stale/all; limit 50/max100; cursor | `meta={availability,nextCursor,evaluatedAt,coverage:{unmappedObservations,legacySignals,rules}}`. “stale” selects observed inactive evidence; it is not a separate provider-health flag. |
| inventory | productId?, warehouseId?, limit 50/max100, cursor | `version`, owner records, top-level `nextCursor`. |
| alerts | state open/acknowledged/resolved optional; limit 50/max100, cursor | Top-level `nextCursor`, **not** `meta.nextCursor`; no severity/target filter in API. |
| scenarios | limit 20/max100, cursor | Summary = `{id,name,createdAt,engineVersion,executed}`; legacy untyped records omitted. No shared summary/list schema export. |

Observation = `{id?,job,provider,recordKey,sourceId,sourceUrl,license,nature,observedAt,fetchedAt,expiresAt,sourceUpdatedAt,data}`. Provider is qatar-open-data/un-comtrade/open-meteo/gdelt/opensky/here/aisstream/authorized-webcam. `data` discriminates by kind: trade (period/reporter/native partner/HS/classification/flow/value/currency/weight), classification, published dependency share, weather/marine (lat/lon/variable/unit/value), news evidence, aircraft/vessel positions, traffic state or authorized-webcam metadata. Exact unions are in `contracts/ingestion.ts`; not every stored kind has a read route.

Read envelope = `{data:Observation[],meta:{availability:"available"|"unavailable",nextCursor:UUID|null}}`. Available means rows exist, not that they are fresh or nationally complete. Job status returns last attempt/success/expiry/status/error/retry/cursor/coverage/nature, optional evidenceFreshUntil and at most five sanitized recent runs. Freshness returns job/lastSuccessAt/effective expiresAt/status fresh|stale|unavailable/nature. No observation is synthesized when unavailable.

**Hypothetical weather read** (`GET /api/v1/weather?job=weather&limit=1`): a model forecast, not a live sensor measurement.

<!-- schema: readResponseSchema -->
```json
{"data":[{"id":"60000000-0000-4000-8000-000000000001","job":"weather","provider":"open-meteo","recordKey":"hypothetical-weather-record","sourceId":"00000000-0000-4000-8000-000000000003","sourceUrl":"https://api.open-meteo.com/v1/forecast","license":"CC BY 4.0; Open-Meteo","nature":"estimated","observedAt":"2026-11-07T01:00:00.000Z","fetchedAt":"2026-11-07T00:00:00.000Z","expiresAt":"2026-11-07T01:00:00.000Z","sourceUpdatedAt":null,"data":{"kind":"weather","latitude":25.3,"longitude":51.5,"variable":"wind_speed_10m","unit":"km/h","value":12}}],"meta":{"availability":"available","nextCursor":null}}
```

The same read envelope is used for trade and transport observations; branch on `data.kind`, not the endpoint name alone. Hypothetical never-synchronized status/freshness examples follow (real status contains all persisted jobs, not just this illustrative entry):

<!-- schema: statusResponseSchema -->
```json
{"data":[{"job":"weather","status":"never","lastAttemptAt":null,"lastSuccessAt":null,"expiresAt":null,"errorCode":null,"nextRetryAt":null,"cursor":0,"coverage":"not-yet-synchronized","nature":"unavailable","recentRuns":[],"evidenceFreshUntil":null}]}
```

<!-- schema: freshnessResponseSchema -->
```json
{"data":[{"job":"weather","lastSuccessAt":null,"expiresAt":null,"status":"unavailable","nature":"unavailable"}]}
```

## 3. Route comparison contract

`contracts/routing.ts`: `routeRequestSchema`, `routeComparisonSchema`, `routeAlternativeSchema`, `networkNodeSchema`, `networkEdgeSchema`, `connectionMetadataSchema`, `provenanceSchema`; inferred `RouteRequest`, `RouteComparison`, `RouteAlternative`, `Network`, `NetworkEdge`, `Provenance`.

| Input | Contract |
|---|---|
| originId / destinationId | Required distinct catalog UUIDs, neither excluded. Unknown stored endpoint → 400 unknown_location. |
| shipment | Optional object; positive finite massKg/volumeM3 ≤1e12, optional commodity ≤100 chars; handling ≤20 strings (default []). |
| preferences | modes default land/sea/air (1..3 entries), allowHypothetical=false, enrichGeometry=false. |
| constraints | maxDurationHours?, maxCost? `{amount,currency}`; maxHops=6 (1..10), maxExpansions=5000 (1..5000), maxAlternatives=10 (1..50), requireConfirmed=false, minConfidence=0 (0..1), excludedNodeIds=[] (≤500), excludedEdgeIds=[] (≤2000). |
| priorities | cost/time/risk nonnegative ≤1e6, default all 1; not all zero. |

Costs use string amounts (1–12 whole digits, at most 6 decimals) and uppercase 3-letter currencies. `routeComparison` contains version/time, alternatives, rejected edge reasons, rejectedRoutes, empty-result reasons, bounded-search coverage, assumptions and optional providerEstimates.

Each alternative contains stable path ID, ordered edgeIds/nodes/legs/modes, GeoJSON FeatureCollection + geometryGaps, cost components/subtotals/nullable total/complete, nullable full duration plus knownDurationHours, nullable distance/risk, riskFactors, confidence, hypothetical, feasibility/reasons, provenance, nullable Pareto status, lower-is-better score/breakdown/rankingReasons. Coordinates are **[longitude,latitude]**. Missing geometry is not permission to draw a plausible service line. Provider estimates are independent available/unavailable/unconfigured navigation estimates, never price or service confirmation.

**Hypothetical request:** uses only the explicit `qatarRoutingDemo()` fixture if provisioned in a disposable test context; those IDs are not production seed IDs. `modes:["land"]` selects its direct land alternative.

<!-- schema: routeRequestSchema -->
```json
{
  "originId":"10000000-0000-4000-8000-000000000001",
  "destinationId":"10000000-0000-4000-8000-000000000003",
  "shipment":{"massKg":1000,"handling":["ambient"]},
  "preferences":{"modes":["land"],"allowHypothetical":true,"enrichGeometry":false},
  "priorities":{"cost":1,"time":1,"risk":1}
}
```

**Full hypothetical response** from the deterministic demo at its fixed evaluation time (not a live quote):

<!-- schema: routeComparisonSchema -->
```json
{
  "engineVersion":"altair-routing-1.0.0","evaluatedAt":"2026-11-06T12:00:00.000Z",
  "alternatives":[{
    "id":"10000000-0000-4000-8000-000000000014","edgeIds":["10000000-0000-4000-8000-000000000014"],
    "nodes":[
      {"id":"10000000-0000-4000-8000-000000000001","name":"Hypothetical UAE export hub","kind":"hub","countryCode":"AE","coordinates":[55.1,24.9]},
      {"id":"10000000-0000-4000-8000-000000000003","name":"Hypothetical Doha distribution hub","kind":"hub","countryCode":"QA","coordinates":[51.5,25.3]}
    ],
    "legs":[{"id":"10000000-0000-4000-8000-000000000014","originId":"10000000-0000-4000-8000-000000000001","destinationId":"10000000-0000-4000-8000-000000000003","mode":"land","metadata":{
      "version":1,"hypothetical":true,
      "provenance":{"source":"ALTAIR hypothetical Qatar demonstration assumptions; NOT a quotation or service confirmation","sourceUrl":null,"observedAt":"2026-11-06T12:00:00.000Z","expiresAt":null,"confidence":0.5,"nature":"simulated"},
      "distanceKm":null,"durationHours":{"min":20,"max":24},"geometry":null,
      "costs":[{"name":"Hypothetical all-in scenario assumption, not freight/customs quotation","amount":"900.00","currency":"USD","basis":"shipment","provenance":{"source":"ALTAIR hypothetical Qatar demonstration assumptions; NOT a quotation or service confirmation","sourceUrl":null,"observedAt":"2026-11-06T12:00:00.000Z","expiresAt":null,"confidence":0.5,"nature":"simulated"}}],
      "costCoverage":"complete","state":"open","capacityKg":10000,"capacityM3":null,"handling":["ambient"],"prohibitedCommodities":[],"risk":0.2
    }}],
    "modes":["land"],"geometry":{"type":"FeatureCollection","features":[]},"geometryGaps":["10000000-0000-4000-8000-000000000014"],
    "cost":{"components":[{"edgeId":"10000000-0000-4000-8000-000000000014","name":"Hypothetical all-in scenario assumption, not freight/customs quotation","basis":"shipment","amount":"900.00","currency":"USD","provenance":{"source":"ALTAIR hypothetical Qatar demonstration assumptions; NOT a quotation or service confirmation","sourceUrl":null,"observedAt":"2026-11-06T12:00:00.000Z","expiresAt":null,"confidence":0.5,"nature":"simulated"}}],"subtotals":[{"currency":"USD","amount":"900.00"}],"total":{"currency":"USD","amount":"900.00"},"complete":true},
    "durationHours":{"min":20,"max":24},"knownDurationHours":{"min":20,"max":24},"distanceKm":null,"risk":0.2,
    "riskFactors":[{"id":"10000000-0000-4000-8000-000000000014","reason":"declared_connection_risk_index_not_probability","contribution":0.2,"source":{"source":"ALTAIR hypothetical Qatar demonstration assumptions; NOT a quotation or service confirmation","sourceUrl":null,"observedAt":"2026-11-06T12:00:00.000Z","expiresAt":null,"confidence":0.5,"nature":"simulated"}}],
    "confidence":0.5,"hypothetical":true,"feasibility":"feasible","reasons":[],
    "provenance":[{"source":"ALTAIR hypothetical Qatar demonstration assumptions; NOT a quotation or service confirmation","sourceUrl":null,"observedAt":"2026-11-06T12:00:00.000Z","expiresAt":null,"confidence":0.5,"nature":"simulated"}],
    "paretoOptimal":true,"score":0,"scoreBreakdown":{"cost":0,"time":0,"risk":0},"rankingReasons":["comparable_objectives","lower_weighted_normalized_score_is_better","ties_use_feasibility_then_stable_edge_ids"]
  }],
  "rejected":[{"edgeId":"10000000-0000-4000-8000-000000000011","reasons":["mode_excluded"]},{"edgeId":"10000000-0000-4000-8000-000000000013","reasons":["mode_excluded"]}],"rejectedRoutes":[],"reasons":[],
  "coverage":{"expansions":2,"evaluatedCandidates":1,"truncated":false,"paretoScope":"evaluated_candidates","limits":{"maxHops":6,"maxExpansions":5000,"maxCandidates":500}},
  "assumptions":["Only explicit directed connections are traversed; proximity and reverse services are never inferred.","Unknown costs are not zero; currencies are never converted.","Times exclude unmodeled customs, waiting and transfers; ranges are not probability distributions.","Risk is a conservative maximum observed index, not a probability; unknown risk is unavailable.","Pareto and ranking apply only to evaluated candidates; unknown objectives incur a conservative penalty."]
}
```

## 4. Risk / scenario contracts and sequencing

`contracts/intelligence.ts`: risk category/target/structured signal/query/response schemas. Signals include id/category/severity/observedAt/optional validFrom/nullable validUntil/target/evidence/provenance/status/rule/nature. Geopolitical confirmed status is invalid. No user risk-write endpoint exists.

**Hypothetical risk read** (`GET /api/v1/risks?category=transportation`), with simulated evidence made explicit rather than represented as a real closure:

<!-- schema: risksResponseSchema -->
```json
{"data":[{"id":"60000000-0000-4000-8000-000000000002","category":"transportation","severity":"high","observedAt":"2026-11-07T00:00:00.000Z","validUntil":"2026-11-08T00:00:00.000Z","target":{"kind":"edge","id":"10000000-0000-4000-8000-000000000014"},"evidence":"Hypothetical transport exposure for interface demonstration; not an operational closure report.","provenance":{"source":"Explicit hypothetical fixture","sourceUrl":null,"observedAt":"2026-11-07T00:00:00.000Z","expiresAt":"2026-11-08T00:00:00.000Z","confidence":0.5,"nature":"simulated"},"status":"potential","rule":"structured-evidence-v1","nature":"simulated"}],"meta":{"nextCursor":null,"availability":"available","evaluatedAt":"2026-11-07T00:00:00.000Z","coverage":{"unmappedObservations":0,"legacySignals":0,"rules":["structured-evidence-v1"]}}}
```

`contracts/scenarios.ts`: `scenarioInputSchema`, `scenarioModificationSchema`, `scenarioSnapshotSchema`, `scenarioRecordSchema`, `simulationOutputSchema`; inferred `ScenarioInput`, `ScenarioSnapshot`, `ScenarioRecord`, `SimulationOutput`.

- Create input: required name (1..200), routeRequest, modifications array (≤100); horizonHours=168 (positive, max8760), hypothetical=false, assumptions=[] (≤30), demand=[] (≤100 productId/unit/decimal quantity), replenishments=[] (≤10 shipmentId/unit/decimal quantity/optional matching routeRequest).
- Modification: connection `{edgeId,closed:true}` **or** one/more capacityFactor [0,1], costFactor/timeFactor [1,1000]; supplier_unavailable `{supplierId}`; inventory_reduction `{inventoryId,quantity}`; demand_increase `{productId,unit,quantity}`; replenishment_delay `{shipmentId,delayHours>0≤8760}`. Unknown/duplicate/conflicting targets and mismatched units fail. Demand/delay changes require corresponding explicit baselines.
- Record: `{id,name,createdAt,engineVersion,baselineReference,input,snapshot,output}`. Snapshot contains version/fixed evaluatedAt/network/risks/owner stock and shipments/supplierIds/references. IDs/inputs/snapshot are immutable. All hypothetical network edges anywhere in the captured network require explicit `hypothetical:true`.
- Output: `{engineVersion,routingEngineVersion,snapshotHash,inputHash,evaluatedAt,nature:"simulated",baseline:{routes,supply},simulated:{routes,supply},routeChanges,changes,assumptions}`. Supply entries are productId/unit/nullable available/demand/shortage/complete/reasons. routeChanges includes lost/gained/conditional returned IDs and nullable preferred cost/time deltas.
- Sequence: create → save returned ID → execute **without body** → compare. Compare before execution is 409 `scenario_not_executed`. Execute/compare revalidate replay integrity; detail GET is shape-validated stored data, not replay verification. No update/delete typed-scenario REST endpoints.

**Hypothetical scenario request** against the same demo network (all modes, unlike the land-only request above):

<!-- schema: scenarioInputSchema -->
```json
{
  "name":"HYPOTHETICAL Qatar essential-equipment transport disruption",
  "routeRequest":{"originId":"10000000-0000-4000-8000-000000000001","destinationId":"10000000-0000-4000-8000-000000000003","shipment":{"massKg":1000,"handling":["ambient"]},"preferences":{"allowHypothetical":true}},
  "hypothetical":true,"horizonHours":168,
  "assumptions":["Demonstration only: no real service, equipment classification or freight quotation is verified."],
  "demand":[],"replenishments":[],
  "modifications":[{"kind":"connection","edgeId":"10000000-0000-4000-8000-000000000011","closed":true},{"kind":"connection","edgeId":"10000000-0000-4000-8000-000000000013","costFactor":2}]
}
```

Without explicit stock/demand/receipt assumptions, this illustrates route recalculation only, **not** a complete replenishment proof. To assess inventory consequences, choose owned product/stock/shipment IDs and supply demand/replenishment baselines, or run the current-operation forecast with the compatible owned scenario.

**Full hypothetical creation/detail record shape**, in a separate two-node/no-connection fixture to demonstrate an unexecuted empty-network state. The opaque baselineReference is illustrative, not an attestation/hash of a deployed record.

<!-- schema: scenarioRecordSchema -->
```json
{
  "id":"70000000-0000-4000-8000-000000000001","name":"HYPOTHETICAL disconnected network","createdAt":"2026-11-07T00:00:00.000Z","engineVersion":"altair-twin-1.0.0","baselineReference":"00000000000000000000000000000000",
  "input":{"name":"HYPOTHETICAL disconnected network","routeRequest":{"originId":"10000000-0000-4000-8000-000000000001","destinationId":"10000000-0000-4000-8000-000000000003","preferences":{"allowHypothetical":true}},"hypothetical":true,"modifications":[]},
  "snapshot":{"version":1,"evaluatedAt":"2026-11-07T00:00:00.000Z","network":{"version":1,"nodes":[{"id":"10000000-0000-4000-8000-000000000001","name":"Hypothetical export hub","kind":"hub","countryCode":"AE","coordinates":null},{"id":"10000000-0000-4000-8000-000000000003","name":"Hypothetical Qatar hub","kind":"hub","countryCode":"QA","coordinates":null}],"edges":[]},"risks":[],"inventory":[],"shipments":[],"supplierIds":[],"references":{}},
  "output":null
}
```

The runtime normally returns fully default-expanded inputs. This compact wire example intentionally omits defaulted keys accepted by the executable response parser; `scenarioRecordSchema.parse()` restores them. For list responses use only summary fields; execute/compare return the simulation **output**, not this record envelope.

## 5. Inventory / orders / forecasting

`contracts/supply.ts` owns the schemas below. The old `inventorySchema`, `Shipment` and other base exports in `contracts/index.ts` are **not** versioned API write contracts (they contain ownerId and numeric quantity). Do not use them as request types.

| Schema / operation | Required and optional fields | Response / side effect |
|---|---|---|
| inventoryWriteSchema | productId, owned warehouseId, quantity string, unit; reservedQuantity="0", historyStart=null | Stock record; quantity/reserved at most 3 decimals. Existing warehouse/product needed. |
| inventoryPatchSchema | nonempty subset of reservedQuantity, historyStart | Stock record; **no physical quantity/product/unit/warehouse patch**. |
| inventoryRecordSchema | id, productId, warehouseId, quantity, reservedQuantity, unit, nullable historyStart | Direct single-record response; no ownerId exposed. |
| movementWriteSchema | inventoryId, kind receipt/consumption/adjustment_in/adjustment_out, positive quantity, unit, occurredAt, trimmed idempotencyKey≤100 | Immutable movement record omits idempotencyKey; parent quantity changes atomically. No future occurrence. |
| orderWriteSchema | inventoryId, positive quantity, unit, dueAt; reservedQuantity="0", status=planned (planned/confirmed/fulfilled/cancelled) | Order fields + id. PATCH requires full schema; defaults apply again and may reset omitted reservation/status. |
| replenishmentWriteSchema | inventoryId, positive quantity≤6 decimals, unit, confirmedQuantity nullable, verifiedUntil nullable, routeRequest nullable | `{shipmentId,quantity,unit,confirmedQuantity,verifiedUntil,routeRequest}`; inventoryId not returned. id is **existing shipment**, not inventory/order. Nonnull confirmation requires expiry and cannot exceed quantity. |
| forecastRequestSchema | inventoryId; historyDays=28/horizonDays=90 (int1..365); coverageDays=30 (0..365); safetyStock="0"; leadTimeDays=null (0..365 or null); leadTimeAlternatives=[] (≤10); dailyDemand? (number0..1e10); scenarioId? | Read-only forecast. Explicit numeric dailyDemand is an assumption, unlike string stock amounts. |

Units must match inventory, shipment product and route endpoints must match destination stock/shipment. Fulfilled/cancelled order records are excluded from active forecasts; status changes do not move physical goods or release stock reservation automatically. Movement history must not be imported twice on top of a balance already containing it.

<!-- schema: inventoryWriteSchema -->
```json
{"productId":"20000000-0000-4000-8000-000000000001","warehouseId":"20000000-0000-4000-8000-000000000002","quantity":"100.000","reservedQuantity":"10.000","unit":"unit","historyStart":null}
```

<!-- schema: inventoryRecordSchema -->
```json
{"id":"20000000-0000-4000-8000-000000000003","productId":"20000000-0000-4000-8000-000000000001","warehouseId":"20000000-0000-4000-8000-000000000002","quantity":"100.000","reservedQuantity":"10.000","unit":"unit","historyStart":null}
```

<!-- schema: inventoryPatchSchema -->
```json
{"reservedQuantity":"20.000"}
```

<!-- schema: movementWriteSchema -->
```json
{"inventoryId":"20000000-0000-4000-8000-000000000003","kind":"consumption","quantity":"5.000","unit":"unit","occurredAt":"2026-11-06T10:00:00.000Z","idempotencyKey":"hypothetical-consumption-001"}
```

<!-- schema: movementRecordSchema -->
```json
{"id":"20000000-0000-4000-8000-000000000004","inventoryId":"20000000-0000-4000-8000-000000000003","kind":"consumption","quantity":"5.000","unit":"unit","occurredAt":"2026-11-06T10:00:00.000Z"}
```

<!-- schema: orderWriteSchema -->
```json
{"inventoryId":"20000000-0000-4000-8000-000000000003","quantity":"20.000","reservedQuantity":"10.000","unit":"unit","dueAt":"2026-11-10T00:00:00.000Z","status":"confirmed"}
```

<!-- schema: orderRecordSchema -->
```json
{"id":"20000000-0000-4000-8000-000000000005","inventoryId":"20000000-0000-4000-8000-000000000003","quantity":"20.000","reservedQuantity":"10.000","unit":"unit","dueAt":"2026-11-10T00:00:00.000Z","status":"confirmed"}
```

<!-- schema: replenishmentWriteSchema -->
```json
{"inventoryId":"20000000-0000-4000-8000-000000000003","quantity":"50.000000","unit":"unit","confirmedQuantity":"40.000000","verifiedUntil":"2026-11-09T00:00:00.000Z","routeRequest":null}
```

<!-- schema: replenishmentRecordSchema -->
```json
{"shipmentId":"20000000-0000-4000-8000-000000000006","quantity":"50.000000","unit":"unit","confirmedQuantity":"40.000000","verifiedUntil":"2026-11-09T00:00:00.000Z","routeRequest":null}
```

<!-- schema: forecastRequestSchema -->
```json
{"inventoryId":"20000000-0000-4000-8000-000000000003","dailyDemand":10,"leadTimeDays":5,"horizonDays":10,"coverageDays":10,"safetyStock":"20","leadTimeAlternatives":[5,10]}
```

Full response schema fields: version/evaluatedAt/inventoryId/unit/nature; projectionBasis/impairedReservations/scenarioDemand; availableStock/coverageDays; consumption `{method,historyDays,averageDaily,trendDaily,uncertainty}`; nullable stockoutAt/safetyStockAt/reorderPoint/suggestedQuantity/recommendedOrderAt; leadTimeRisks; replenishment eligibility/adjusted arrival/reasons; event/daily projection; limitations. No persisted forecast ID or forecast-list endpoint exists.

**Full hypothetical response**, separate simple context: 100 unreserved units, explicit 10/day, no orders/receipts, 2-day displayed horizon, 5-day lead and 10-day purchasing coverage. Suggested quantity=20+150−100=70; no threshold date is asserted beyond the displayed horizon.

<!-- schema: forecastResponseSchema -->
```json
{
  "version":"supply-1.0.0","evaluatedAt":"2026-11-07T00:00:00.000Z","inventoryId":"20000000-0000-4000-8000-000000000003","unit":"unit","nature":"estimated",
  "projectionBasis":"recurring_and_orders","impairedReservations":"0.000000","scenarioDemand":null,
  "availableStock":"100.000000","coverageDays":10,
  "consumption":{"method":"explicit_daily_demand","historyDays":0,"averageDaily":10,"trendDaily":null,"uncertainty":null},
  "stockoutAt":null,"safetyStockAt":null,"reorderPoint":"70.000000","suggestedQuantity":"70.000000","recommendedOrderAt":null,
  "leadTimeRisks":[{"leadTimeDays":5,"shortageBeforeArrival":false,"expectedShortage":"0.000000","stressDemandShortage":null}],
  "replenishments":[],
  "projection":[{"at":"2026-11-07T00:00:00.000Z","available":"100.000000","unfilledOrderQuantity":"0.000000"},{"at":"2026-11-08T00:00:00.000Z","available":"90.000000","unfilledOrderQuantity":"0.000000"},{"at":"2026-11-09T00:00:00.000Z","available":"80.000000","unfilledOrderQuantity":"0.000000"}],
  "limitations":["daily_mean_stationary_demand_not_llm_prediction","planned_orders_are_additive_to_recurring_demand","reservations_excluded_once_orders_consume_only_unreserved_quantity","dates_are_estimates_not_delivery_commitments","no_unit_conversion","recommendations_do_not_assert_supplier_availability","insufficient_history_for_statistical_uncertainty"]
}
```

## 6. Supplier / import dependency contracts

Search: optional productId, hsCode (2..8 digits) with **classification required when hsCode supplied**, countryCodes=[] (≤30), locationId?, capabilities=[] (≤20), limit=20/max100, cursor?. All filters combine; country/location are explicit and capabilities exact case-insensitive names. Response includes version/evaluatedAt/matches/nextCursor/limitations; match has id/name/countryCode/matchStatus/availability/score/reasons/evidence. It does not expose private procurement.

<!-- schema: supplierSearchSchema -->
```json
{"productId":"20000000-0000-4000-8000-000000000001","countryCodes":["QA"],"capabilities":["ambient storage"],"limit":20}
```

<!-- schema: supplierSearchResponseSchema -->
```json
{"version":"supply-1.0.0","evaluatedAt":"2026-11-07T00:00:00.000Z","data":[{"id":"30000000-0000-4000-8000-000000000001","name":"Hypothetical equipment directory supplier","countryCode":"QA","matchStatus":"potential_match","availability":"unverified","score":35,"reasons":["supplier_unverified_or_outdated","match_requires_fresh_confirmed_evidence","catalog_match_is_not_stock_or_fulfillment_confirmation"],"evidence":[{"id":"30000000-0000-4000-8000-000000000002","sourceUrl":"https://example.org/hypothetical-directory","description":"Demonstration catalog evidence, not current stock confirmation","observedAt":"2026-11-01T00:00:00.000Z","expiresAt":"2026-12-01T00:00:00.000Z","status":"inferred"}]}],"nextCursor":null,"limitations":["catalog_coverage_not_exhaustive","availability_and_order_fulfillment_require_private_current_verification","score_is_matching_index_not_probability"]}
```

Dependency input: required reporter string, hsCode 2..8 digits, classification string, currency QAR|USD; provider qatar-open-data|un-comtrade optional, affectedOrigins=[] (≤100), originCountryMappings=[] (≤100 unique native origin + uppercase ISO countryCode), scenarioId optional. Reporter/partner/classification labels must match stored evidence exactly, e.g. Qatar reporter `Qatar` versus Comtrade `634`; do not guess HS edition. Multiple comparable providers → 409 select_single_trade_provider.

<!-- schema: importDependencyRequestSchema -->
```json
{"reporter":"Qatar","hsCode":"90189000","classification":"Qatar HS8 (edition unspecified)","currency":"QAR","provider":"qatar-open-data","affectedOrigins":["Hypothetical Origin A"],"originCountryMappings":[]}
```

This hypothetical equipment HS example is **not** present in the default 2024/HS10 cereal ingestion configuration. An empty result is expected unless matching evidence was actually ingested through an approved configuration.

<!-- schema: importDependencyResponseSchema -->
```json
{"version":"supply-1.0.0","periods":[{"period":"2024-01","totalValue":"400.000000","origins":[{"origin":"Hypothetical Origin A","value":"300.000000","share":0.75},{"origin":"Hypothetical Origin B","value":"100.000000","share":0.25}],"hhi":0.625,"effectiveOrigins":1.6,"topOriginShare":0.75,"exposedShare":0.75,"changePercent":null}],"limitations":["observed_origins_not_comprehensive_imports","hhi_is_value_share_concentration_not_disruption_probability","native_country_identifiers_require_explicit_mapping","no_currency_hs_edition_or_monthly_annual_aggregation","trade_value_is_not_inventory_or_supplier_capacity","period_changes_are_not_seasonally_adjusted"]}
```

`sourceObservations?` is additive attribution metadata, omitting observation data, drawn from the same calculation inputs. The HTTP handler populates it (including an empty array); the pure calculation above need not. No-data response has periods=[], not fabricated zero HHI. Aggregate World/0 partners are excluded from concentration even when ingestion succeeded.

## 7. Monitoring / alerts / Realtime

`contracts/monitoring.ts` exports `monitoringConfigSchema`, `monitoringEvaluationSchema`, `alertQuerySchema`, `alertTransitionSchema`, `alertRecordSchema`, `alertRuleSchema`, `alertSeveritySchema` and candidate schema/types.

- PUT is full replacement. Omitted rules/arrays/thresholds default, so merge deliberately in UI before saving if preserving current settings. Config rules: disrupted_route, severe_environment, stale_shipment, increased_cost, route_delay, potential_stockout; each enabled=true/severity=high.
- Thresholds: staleShipmentHours=24 (1..8760), costIncreasePercent=20 (0..10000), routeDelayHours=2 (0..8760).
- shipments≤50: shipmentId, 1..20 edgeIds, baselineCost nullable `{amount,currency}` and baselineDurationHours nullable positive≤8760. inventories≤10 are forecast requests, **without scenarioId**. trafficMappings≤100: providerId, 1..20 existing **land** edgeIds. Duplicate top-level targets fail.
- GET config returns defaults even without a stored row; persist PUT before expecting a scheduler to find this owner. POST evaluate `{}` creates settings if needed, evaluates current operations and returns candidates/evaluatedKeys/limitations/time/version plus persistence.changed. It does not return the full saved alert list; refetch alerts.
- PATCH accepts only acknowledged/resolved. It cannot reopen or delete. A resolved episode remains resolved on another transition request; renewed active evaluation may reopen it. Acknowledgment is the appropriate response to an ongoing accepted condition; manual resolution can reopen next evaluation.

<!-- schema: monitoringConfigSchema -->
```json
{"staleShipmentHours":24,"costIncreasePercent":20,"routeDelayHours":2,"shipments":[{"shipmentId":"20000000-0000-4000-8000-000000000006","edgeIds":["10000000-0000-4000-8000-000000000014"],"baselineCost":{"amount":"900.00","currency":"USD"},"baselineDurationHours":24}],"inventories":[],"trafficMappings":[]}
```

<!-- schema: alertTransitionSchema -->
```json
{"state":"acknowledged"}
```

<!-- schema: alertRecordSchema -->
```json
{"id":"40000000-0000-4000-8000-000000000001","title":"Shipment update is overdue","shipmentId":"20000000-0000-4000-8000-000000000006","rule":"stale_shipment","dedupKey":"stale_shipment:shipment:20000000-0000-4000-8000-000000000006","targetKind":"shipment","targetId":"20000000-0000-4000-8000-000000000006","severity":"high","state":"acknowledged","action":"Request a verified update from the carrier or shipment owner.","evidence":["last_owner_update:2026-11-05T00:00:00.000Z"],"occurrence":1,"notificationCount":1,"createdAt":"2026-11-07T00:00:00.000Z","updatedAt":"2026-11-07T00:01:00.000Z","acknowledgedAt":"2026-11-07T00:01:00.000Z","resolvedAt":null}
```

Alert fields rule/dedupKey/targetKind/targetId/action/shipmentId may be null for legacy records. Deduplicate UI notifications by `(id,occurrence,notificationCount)`, not each UPDATE. Evidence loss/outage is not recovery; stale evidence-based alerts can remain latched. Terminal shipments do not automatically clear every previous cost/delay alert.

Realtime is **optional and unverified live**. `packages/db/operations/monitoring-realtime.sql` remains inactive. After separately authorized publication activation, use an authenticated Supabase browser client for INSERT/UPDATE on `public.alerts` with owner filter for efficiency; RLS is authorization. Treat callbacks as refetch signals to GET alerts; refetch after reconnect and remove channels on sign-out. Do not subscribe to DELETE (no RLS authorization for delete events). No observation WebSocket API is implemented.

## 8. Assistant contract and approval flow

`contracts/assistant.ts`: `assistantRequestSchema`, `approvedToolInputSchema`, `assistantResponseSchema`, `assistantEvidenceSchema`, task/action/model-selection schemas. It is JSON request/response, **not SSE or token streaming**.

Input: message trimmed1..8000, optional owned conversationId, allowSimulationCreation=false, approvedToolInputs=[] (≤6). Approved tool names: compare_routes / forecast_inventory / create_simulation / import_dependencies; arguments are validated against that tool's domain schema on use. Approval is exact, current-request only. Scenario creation also needs the explicit boolean. Forecast defaults for an owned inventory UUID are permitted without additional approval; assumption-bearing overrides are not.

<!-- schema: assistantRequestSchema -->
```json
{"message":"Estimate replenishment using my hypothetical declared demand of 10 units/day and 5-day lead time.","approvedToolInputs":[{"tool":"forecast_inventory","arguments":{"inventoryId":"20000000-0000-4000-8000-000000000003","dailyDemand":10,"leadTimeDays":5}}]}
```

Response always includes version/status/task/evaluatedAt/explanation/findings/recommendations/evidence/errors/limitations/pendingToolRequests; successful admission adds conversationId/turnId. A finding selects `{evidenceId,pointer,kind,value,explanation}`. An evidence item includes tool/data/validated parameters/parameterAuthority/retrievedAt/references/source metadata. Kind is fact/estimate/prediction/hypothetical, not a guarantee of source accuracy. Actions are verify_records, compare_alternatives, review_replenishment, verify_supplier, review_scenario, request_evidence.

**Hypothetical full degraded response** illustrating missing provider configuration (IDs/timestamps are illustrative). The deployed response also carries the orchestrator's full limitations list; these fields are schema-valid without requiring a live provider.

<!-- schema: assistantResponseSchema -->
```json
{"version":"assistant-1.0.0","status":"degraded","task":"clarification","conversationId":"50000000-0000-4000-8000-000000000001","turnId":"50000000-0000-4000-8000-000000000002","evaluatedAt":"2026-11-07T00:00:00.000Z","explanation":"No supported recommendation is available. Provide missing record identifiers or review the evidence and error states.","findings":[],"recommendations":[],"evidence":[],"errors":[{"code":"llm_disabled"}],"limitations":["llm_selects_evidence_not_calculations","source_text_and_history_are_untrusted","records_are_not_live_verified_availability","estimates_are_not_delivery_or_procurement_commitments","tools_do_not_book_or_order","prior_evidence_is_not_reused_as_current","assumption_bearing_parameters_require_structured_user_approval","raw_evidence_is_untrusted_not_an_instruction"],"pendingToolRequests":[]}
```

If tool_approval_required appears, display proposed arguments **as a proposal**, let the user review/edit, then resubmit the corresponding approvedToolInputs (and permission if needed), optionally with the returned owned conversationId. Do not silently auto-approve the model's quantities/routes/demand. Evidence IDs are request-local; never use historical evidence IDs as current results. No conversation/history GET endpoint exists. Stored history is owner-editable through narrow RPC completion and must not be advertised as attested replay.

## 9. Errors, retry and availability semantics

| Surface | Actual HTTP errors / codes |
|---|---|
| health | 503 `{status:"unavailable",database:"disconnected"}`; no Auth requirement; checks SELECT1 only. |
| trade/weather/observations/status/freshness | 400 invalid_query; 401 unauthorized; 503 service_unavailable (including configuration/storage/malformed result). |
| routes/compare | 400 invalid_request or unknown_location; 401 unauthorized; 503 service_unavailable. Disconnected graph is 200 alternatives=[]/no_feasible_path. |
| risks/scenarios | 400 invalid_request; 401 unauthorized; 404 not_found; 409 unsupported_engine_version, scenario_not_executed, execution_integrity_conflict; 503 service_unavailable. Storage RPC conflicts not specifically mapped by web store can surface as 503; do not assume every SQL conflict becomes409. |
| supply APIs | 400 invalid_request (including listed FK/check/precision/duplicate/conflicting mutations mapped in web store); 401 unauthorized; 404 not_found for missing/inaccessible updated/calculated record; 409 scenario_baseline_changed, unsupported_engine_version, select_single_trade_provider; 503 service_unavailable. Constraint failures on create may be400 rather than404. |
| monitoring/alerts | 400 invalid_request; 401 unauthorized; 404 not_found for inaccessible alert; 409 monitoring_evaluation_conflict; 503 service_unavailable. Equal-millisecond/older reconciliation should be retried with a **new** evaluation after refetching config. |
| assistant HTTP admission | 400 invalid_request; 401 unauthorized; 408 request_timeout (body/deadline); 404 not_found conversation; 409 conversation_limit; 429 rate_limited with Retry-After:60; 503 storage_unavailable or service_unavailable. |
| assistant normal inference/tool failure | **200 degraded**, errors e.g. llm_disabled, llm_configuration_invalid, provider_rate_limited (retryAfterSeconds), provider_unavailable/timeout/rejected, invalid_model_output, invalid_tool_arguments, unknown_tool, not_found, calculation_conflict, tool_unavailable/result_too_large, simulation_creation_not_authorized, tool_approval_required, enrichment_not_authorized, context_limit/evidence_limit/tool_limit/repeated_tool_call/model_round_limit/missing_evidence/untrusted_text_not_a_finding/unsupported_recommendation/request_timeout. |
| internal ingestion | 401 unauthorized; 404 unknown_job; 503 scheduler_unconfigured/ingestion_unavailable or failed/unconfigured result; 409 busy; 429 deferred; 200 cached/success. Failure result uses errorCode (not error) and optional runId. No Retry-After header is attached here; inspect status nextRetryAt. |
| internal monitoring | 400 invalid_request; 401 unauthorized; 503 scheduler_unconfigured/monitoring_unavailable or result.failed>0; 200 otherwise. Counters contain no owner identities. |

401 is for absent/unverified identity; failure constructing Auth configuration/storage can instead become503. Cross-owner and nonexistent private resources are deliberately indistinguishable. Sanitized codes, not upstream bodies/SQL messages/stacks, go to clients. Do not change an unavailable field to zero. Retry read-only calculations deliberately; never blindly replay creates/orders/movements/assistant admissions after an uncertain network result. Reuse movement idempotencyKey to avoid double application (duplicate returns400, not prior result).

No general REST request limiter is present beyond assistant admission and internal job serialization/cache/cooldown. Supplier/provider quota limits are independent. A general client retry loop must not defeat long upstream cooldowns or repeatedly consume assistant admissions.

## 10. Frontend consumption examples

Documentation-only snippet; not an existing SDK. It imports browser-safe contracts, keeps cookies same-origin and validates both input/output. Convert form numbers to required amount strings **before** schema parsing where appropriate; do not cast API errors into result types.

```ts
import { z } from 'zod'
import { routeRequestSchema, routeComparisonSchema } from '@altair/shared/contracts'

async function compare(input: z.input<typeof routeRequestSchema>, signal?: AbortSignal) {
  const request = routeRequestSchema.parse(input)
  const response = await fetch('/api/v1/routes/compare', {
    method: 'POST', credentials: 'same-origin', cache: 'no-store', signal,
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request),
  })
  const body: unknown = await response.json()
  if (!response.ok) {
    // UI branches by status; body is an untrusted error object, not a route result.
    throw Object.assign(new Error('Route request failed'), { status: response.status, body })
  }
  return routeComparisonSchema.parse(body)
}

// After a successful scenario create, use its returned UUID; intentionally no body.
async function executeScenario(id: string) {
  return fetch(`/api/v1/scenarios/${encodeURIComponent(id)}/execute`, {
    method: 'POST', credentials: 'same-origin', cache: 'no-store',
  }) // Validate JSON with simulationOutputSchema after checking response.ok.
}
```

For every pending request, retain prior valid data as explicitly previous data, abort superseded read-only UI requests, and prevent older responses replacing newer filter/scenario state. Aborting a fetch does not undo a server write. An assistant200 still needs `status/errors/pendingToolRequests` checks. Unknown schema mismatch is an integration error; do not render it as empty success.

## 11. Concise private OpenAPI discovery index

The following **OpenAPI 3.1** block inventories all operations and their auth class; it is intentionally a permissive discovery index, **not a replacement for the strict Zod schemas/tables above**. Success/error schemas are generic JSON objects; do not generate final typed clients from them. `x-input`/`x-output` name actual shared exports, or explicit handler-local shapes. `id`/`job` parameters are required. Cookie name is an illustrative project-specific placeholder: Supabase may split sessions across multiple cookie chunks; import cookies from a real session rather than using this name literally. There is no generic bearer-user scheme.

```yaml
openapi: 3.1.0
info: {title: ALTAIR private API discovery, version: '2026-11-07'}
servers: [{url: /}]
security: [{supabaseSession: []}]
components:
  securitySchemes:
    supabaseSession: {type: apiKey, in: cookie, name: sb-project-ref-auth-token, description: 'Illustrative only; actual verified SSR cookie session, including all project-specific chunks.'}
    schedulerBearer: {type: http, scheme: bearer, description: 'Server-only INGESTION_SECRET; never user JWT.'}
  parameters:
    id: {name: id, in: path, required: true, schema: {type: string, format: uuid}}
    job: {name: job, in: path, required: true, schema: {type: string, enum: [qatar-imports, qatar-dependencies, comtrade, weather, marine, gdelt, opensky, here-flow, here-incidents, aisstream, webcams]}}
  responses:
    json: {description: 'See endpoint-specific response and errors above; HTTP 200 can be degraded or unavailable.', content: {application/json: {schema: {type: object}}}}
    created: {description: 'Created private record; see shared Zod contract.', content: {application/json: {schema: {type: object}}}}
    error: {description: 'Sanitized endpoint-specific error; see status table.', content: {application/json: {schema: {type: object}}}}
paths:
  /api/v1/health:
    get: {operationId: health, security: [], responses: {'200': {$ref: '#/components/responses/json'}, '503': {$ref: '#/components/responses/error'}}}
  /api/v1/trade:
    get: {operationId: trade, x-input: readQuerySchema, x-output: readResponseSchema, responses: {'200': {$ref: '#/components/responses/json'}, default: {$ref: '#/components/responses/error'}}}
  /api/v1/weather:
    get: {operationId: weather, x-input: readQuerySchema, x-output: readResponseSchema, responses: {'200': {$ref: '#/components/responses/json'}, default: {$ref: '#/components/responses/error'}}}
  /api/v1/observations:
    get: {operationId: observations, x-input: readQuerySchema, x-output: readResponseSchema, responses: {'200': {$ref: '#/components/responses/json'}, default: {$ref: '#/components/responses/error'}}}
  /api/v1/ingestion/status:
    get: {operationId: ingestionStatus, x-output: statusResponseSchema, responses: {'200': {$ref: '#/components/responses/json'}, default: {$ref: '#/components/responses/error'}}}
  /api/v1/freshness:
    get: {operationId: freshness, x-output: freshnessResponseSchema, responses: {'200': {$ref: '#/components/responses/json'}, default: {$ref: '#/components/responses/error'}}}
  /api/v1/routes/compare:
    post: {operationId: compareRoutes, x-input: routeRequestSchema, x-output: routeComparisonSchema, responses: {'200': {$ref: '#/components/responses/json'}, default: {$ref: '#/components/responses/error'}}}
  /api/v1/risks:
    get: {operationId: risks, x-input: risksQuerySchema, x-output: risksResponseSchema, responses: {'200': {$ref: '#/components/responses/json'}, default: {$ref: '#/components/responses/error'}}}
  /api/v1/scenarios:
    get: {operationId: listScenarios, x-output: 'handler-local summary list with meta.nextCursor', responses: {'200': {$ref: '#/components/responses/json'}, default: {$ref: '#/components/responses/error'}}}
    post: {operationId: createScenario, x-input: scenarioInputSchema, x-output: scenarioRecordSchema, responses: {'201': {$ref: '#/components/responses/created'}, default: {$ref: '#/components/responses/error'}}}
  /api/v1/scenarios/{id}:
    parameters: [{$ref: '#/components/parameters/id'}]
    get: {operationId: scenario, x-output: scenarioRecordSchema, responses: {'200': {$ref: '#/components/responses/json'}, default: {$ref: '#/components/responses/error'}}}
  /api/v1/scenarios/{id}/execute:
    parameters: [{$ref: '#/components/parameters/id'}]
    post: {operationId: executeScenario, x-input: 'no body', x-output: simulationOutputSchema, responses: {'200': {$ref: '#/components/responses/json'}, default: {$ref: '#/components/responses/error'}}}
  /api/v1/scenarios/{id}/compare:
    parameters: [{$ref: '#/components/parameters/id'}]
    get: {operationId: compareScenario, x-output: simulationOutputSchema, responses: {'200': {$ref: '#/components/responses/json'}, default: {$ref: '#/components/responses/error'}}}
  /api/v1/inventory:
    get: {operationId: inventory, x-input: inventoryQuerySchema, x-output: inventoryListResponseSchema, responses: {'200': {$ref: '#/components/responses/json'}, default: {$ref: '#/components/responses/error'}}}
    post: {operationId: createInventory, x-input: inventoryWriteSchema, x-output: inventoryRecordSchema, responses: {'201': {$ref: '#/components/responses/created'}, default: {$ref: '#/components/responses/error'}}}
  /api/v1/inventory/{id}:
    parameters: [{$ref: '#/components/parameters/id'}]
    patch: {operationId: updateInventory, x-input: inventoryPatchSchema, x-output: inventoryRecordSchema, responses: {'200': {$ref: '#/components/responses/json'}, default: {$ref: '#/components/responses/error'}}}
  /api/v1/inventory/movements:
    post: {operationId: movement, x-input: movementWriteSchema, x-output: movementRecordSchema, responses: {'201': {$ref: '#/components/responses/created'}, default: {$ref: '#/components/responses/error'}}}
  /api/v1/inventory/orders:
    post: {operationId: createOrder, x-input: orderWriteSchema, x-output: orderRecordSchema, responses: {'201': {$ref: '#/components/responses/created'}, default: {$ref: '#/components/responses/error'}}}
  /api/v1/inventory/orders/{id}:
    parameters: [{$ref: '#/components/parameters/id'}]
    patch: {operationId: replaceOrder, x-input: orderWriteSchema, x-output: orderRecordSchema, responses: {'200': {$ref: '#/components/responses/json'}, default: {$ref: '#/components/responses/error'}}}
  /api/v1/inventory/replenishments/{id}:
    parameters: [{$ref: '#/components/parameters/id'}]
    patch: {operationId: updateReplenishment, x-input: replenishmentWriteSchema, x-output: replenishmentRecordSchema, responses: {'200': {$ref: '#/components/responses/json'}, default: {$ref: '#/components/responses/error'}}}
  /api/v1/forecasts:
    post: {operationId: forecast, x-input: forecastRequestSchema, x-output: forecastResponseSchema, responses: {'200': {$ref: '#/components/responses/json'}, default: {$ref: '#/components/responses/error'}}}
  /api/v1/suppliers/search:
    post: {operationId: suppliers, x-input: supplierSearchSchema, x-output: supplierSearchResponseSchema, responses: {'200': {$ref: '#/components/responses/json'}, default: {$ref: '#/components/responses/error'}}}
  /api/v1/import-dependencies:
    post: {operationId: importDependencies, x-input: importDependencyRequestSchema, x-output: importDependencyResponseSchema, responses: {'200': {$ref: '#/components/responses/json'}, default: {$ref: '#/components/responses/error'}}}
  /api/v1/monitoring/config:
    get: {operationId: monitoringConfig, x-output: 'handler-local config envelope', responses: {'200': {$ref: '#/components/responses/json'}, default: {$ref: '#/components/responses/error'}}}
    put: {operationId: replaceMonitoringConfig, x-input: monitoringConfigSchema, x-output: 'handler-local config envelope', responses: {'200': {$ref: '#/components/responses/json'}, default: {$ref: '#/components/responses/error'}}}
  /api/v1/monitoring/evaluate:
    post: {operationId: evaluateMonitoring, x-input: 'strict empty object', x-output: 'monitoringEvaluationSchema plus persistence.changed', responses: {'200': {$ref: '#/components/responses/json'}, default: {$ref: '#/components/responses/error'}}}
  /api/v1/alerts:
    get: {operationId: alerts, x-input: alertQuerySchema, x-output: 'handler-local alert list with nextCursor', responses: {'200': {$ref: '#/components/responses/json'}, default: {$ref: '#/components/responses/error'}}}
  /api/v1/alerts/{id}:
    parameters: [{$ref: '#/components/parameters/id'}]
    patch: {operationId: transitionAlert, x-input: alertTransitionSchema, x-output: alertRecordSchema, responses: {'200': {$ref: '#/components/responses/json'}, default: {$ref: '#/components/responses/error'}}}
  /api/v1/assistant/chat:
    post: {operationId: assistant, x-input: assistantRequestSchema, x-output: assistantResponseSchema, responses: {'200': {$ref: '#/components/responses/json'}, default: {$ref: '#/components/responses/error'}}}
  /api/internal/ingestion/{job}:
    parameters: [{$ref: '#/components/parameters/job'}]
    post: {operationId: ingest, security: [{schedulerBearer: []}], x-output: 'backend IngestionResult', responses: {'200': {$ref: '#/components/responses/json'}, default: {$ref: '#/components/responses/error'}}}
  /api/internal/monitoring:
    post: {operationId: scheduledMonitoring, security: [{schedulerBearer: []}], x-output: 'evaluated/failed/changed counters', responses: {'200': {$ref: '#/components/responses/json'}, default: {$ref: '#/components/responses/error'}}}
```

**Contract gaps to coordinate, not silently patch:** no shared Zod schemas for health, scenario summary/list, alert list envelope, monitoring config envelope or persisted evaluation envelope; no typed REST catalog/warehouse/shipment CRUD, movement/order list or assistant history read. `locationSchema` (legacy) omits `terminal`/coordinates while `networkNodeSchema` and the database support them. Use the versioned endpoint schemas and agree on additions before changing shared contracts.
