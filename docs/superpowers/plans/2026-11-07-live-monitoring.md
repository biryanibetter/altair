# Live Logistics Monitoring Implementation Plan

> **For agentic workers:** Use executing-plans for inline implementation. Track completed steps below.

**Goal:** Extend existing ingestion/intelligence with honest transport evidence and private actionable alert lifecycles.
**Architecture:** Reuse provider_observations, leased ingestion, route/risk/forecast engines and alerts. Add only owner monitoring configuration; never duplicate shipment or inventory storage. Evaluation is authenticated and bounded; persistence serializes each owner's reconciliation.
**Tech Stack:** TypeScript, Zod, Drizzle/PostgreSQL, Next.js server handlers, Supabase Auth/RLS/Realtime, Vitest/PGlite.
**Spec:** User Task 006 and docs/internal/ALTAIR_BACKEND_SPEC.md.

## Global Constraints
- No fabricated live observations or cargo-location inference from aircraft/vessel broadcasts.
- No remote writes, activation, deployment, paid calls, commits or unrelated UI changes.
- Credentials stay server-only; unsupported providers fail closed, retaining last good evidence.
- Cameras are optional, require an operator-reviewed authorized manifest, and never fetch private infrastructure.

## Review Focus
- Replayed stale positions must not become current just because polling succeeded.
- Overlapping evaluations must not duplicate notifications or let an older result resolve a newer alert.
- Unknown/missing provider data must not be treated as a cleared disruption.
- Cross-owner references and direct SQL/RPC access must preserve isolation.
- Route association requires explicit configuration, never vessel/aircraft proximity guesses.

### Task 1: Provider observations
Files: shared/contracts/ingestion.ts; backend/src/providers/transport-network.ts, aisstream.ts; backend/src/ingestion.ts; backend/test/monitoring-providers.test.ts.
- [x] Write failing tests for opt-in configuration, normalization, event deduplication keys, stale/future times, malformed positions, provider outages and reconnection.
- [x] Run focused Vitest and observe missing behavior.
- [x] Extend jobs/contracts/sources; use existing ingestion for polling and bounded AIS worker collection with reconnect/backoff. Use explicit provider IDs and event-age freshness. Keep shipment provider disabled when no credentials/provider contract exists.
- [x] Run provider and ingestion regressions.

### Task 2: Monitoring engine and lifecycle persistence
Files: shared/contracts/monitoring.ts; backend/src/monitoring/{evaluate,http,rows}.ts; db schema/private.ts and new migration; backend/test/monitoring*.test.ts.
Interfaces: evaluateMonitoring(context, config) returns candidates plus explicitly evaluated rule/target scopes; RPC reconciliation updates existing alerts atomically and idempotently.
- [x] Write failing rule tests: stale shipments, explicitly mapped road events, weather/risk, comparable cost increase, route delay, stockout forecast and missing evidence.
- [x] Implement deterministic evaluation reusing compareRoutes, signalActive and forecastInventory. Label potential network impact; do not mutate operations.
- [x] Write failing PostgreSQL tests for acknowledgment/resolution/reopen, duplicate/repeated notifications, old evaluation fencing and two-owner RLS.
- [x] Extend alerts and add owner configuration, invoker snapshot/reconciliation/lifecycle functions. Validate ownership and serialize evaluation; unchanged active alerts cause no write/Realtime repeat. Missing evidence does not auto-resolve evidence-based rules.
- [x] Run focused tests and existing database regressions.

### Task 3: API, scheduling and operations
Files: apps/web/lib/backend/monitoring.ts; apps/web/app/api/v1/{monitoring,alerts,observations}/*; db/operations templates; .env.example; internal spec.
- [x] Test authentication, strict input, provider error sanitization and route wiring.
- [x] Add owner-JWT evaluation/config/list/ack endpoints and transport observation reads. Realtime publication is opt-in operator SQL; use existing alerts/RLS and INSERT/UPDATE only.
- [x] Document polling schedules, AIS worker gating, camera manifest/license gating, no authorized shipment provider configured, and actual vs fixture-only verification.
- [x] Run pnpm -r --if-present test, lint, build, then uncached typecheck and diff checks. Record exact results and remaining external activation checks in the internal backend specification; stop.

## Execution record

- Pre-flight: Task 1's Observation/ProviderJob extends the same contracts Task 2 reads; Task 2's validated evaluation is passed unchanged to Task 3 reconciliation. No duplicate store/interface introduced.
- Ruling: preserve the existing dirty workspace rather than creating a clean worktree that lacks the uncommitted backend — required to extend actual Tasks 002–005 without discarding/copying unrelated work; cost: no isolated commit range. No commits were made.
- Ruling: evidence-based alerts latch for human review when evidence expires — absence cannot establish recovery; cost: manual resolution after verifying clearance.
- Ruling: no vendor-specific shipment integration without credentials/provider authorization; camera adapter is metadata-only and disabled without a reviewed manifest/collector — prevents guessed access or fabricated observations; cost: operator/vendor work before live use.
- Task 1 complete: provider/AIS/camera/outage tests pass; existing transport additionally honors OpenSky's documented quota cooldown header.
- Task 2 complete: deterministic rules, private lifecycle and runner tests pass; real stock snapshot generates a stockout alert without changing stock.
- Task 3 complete: full suite **149 passed / 6 skipped**, lint/build/uncached post-build typecheck and offline schema consistency pass. Six skips are the pre-existing opt-in public-provider tests.
- Final fresh-context review: three Important findings reproduced RED→GREEN: stale/future metric evidence, premature future closure, and historical traffic versions overwhelming snapshots. Snapshot now selects latest configured provider IDs before limits; a 6,000-version regression passes. Index added in `0007_outgoing_hiroim.sql`.
- Final minor (deferred): cost/delay alerts for terminal shipments require manual resolution rather than automatic cleanup.
- Final minor (deferred): PGlite serializes one connection; native overlapping-transaction/lock contention verification remains a pre-production gate.

## Delivery self-evaluation

Overall **4.0/5**: verified local backend behavior; external operational access remains explicitly unproven.

| Axis | Score | Evidence / improvement |
| --- | --- | --- |
| Accuracy | 4 | 149 passing tests, independent findings fixed, build/types clean; verify new provider schemas against licensed live responses before activation |
| Completeness | 4 | Provider adapters, six rules, owner lifecycle, scheduler and Realtime template delivered; native concurrent-lock and deployed Realtime delivery remain external gates |
| Clarity | 4 | Internal spec distinguishes fixture-only/access-gated integrations; the detailed operational section is lengthy |
| Actionability | 4 | API/config examples and inactive operator SQL supplied; activation still needs authorized credentials and migration |
| Conciseness | 4 | No UI or duplicate store added; plan/spec contain substantial verification detail |

Highest-impact follow-ups: authorized live access checks; native concurrent transactions; terminal cost/delay lifecycle cleanup. Self-check: these scores reflect local verification, not a production-operational claim.
