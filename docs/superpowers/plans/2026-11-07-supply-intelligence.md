# Supply Intelligence Implementation Plan

> **For agentic workers:** Use executing-plans to implement this plan task-by-task. User authorized inline implementation without further brainstorming.

**Goal:** Deliver Task 005 backend inventory forecasting, supplier matching and import dependency analysis without frontend changes.

**Architecture:** Extend existing stock/shipment/catalog tables; add only child records for movements, orders and supplier evidence. Pure deterministic services consume strict shared contracts and owner-scoped snapshots. Extract replenishment evaluation from the existing twin engine so both engines use the same route and crisis logic.

**Tech Stack:** TypeScript, Zod 4, Drizzle/PostgreSQL, Supabase JWT/RLS, Next.js API wrappers, Vitest/PGlite.

**Spec:** `docs/internal/ALTAIR_BACKEND_SPEC.md`, Task 005 user requirements in this session.

## Global Constraints
- Preserve frontend and all existing uncommitted work. No deployment, remote migration, provider calls, commits or pushes.
- Coverage-first recommendations also include dated planned/confirmed order commitments; no LLM predictions.
- Private inventories/procurement remain owner-scoped; public reference writes remain trusted-only.
- No implicit unit/currency/HS-edition/country-code conversion or supplier availability assumptions.

## Review Focus
- Reserved orders must not consume the same free stock twice.
- No history is unknown demand, not measured zero; zero days count only inside an explicitly declared history window.
- Late/unknown/partially verified replenishment cannot become immediately available inventory.
- Stale or inferred supplier matches cannot become fulfillment commitments.
- Partial trade evidence and aggregate country records cannot imply complete import concentration.

### Task 1: Deterministic services and shared interfaces
- [x] Write failing tests in `packages/backend/test/supply.test.ts` for consumption, missing history, order/reservation overlap, uncertain lead time, units, stale suppliers, HHI and scenario delays; run focused Vitest and observe missing implementation.
- [x] Add `packages/shared/src/contracts/supply.ts` with strict versioned request, snapshot and response schemas; export through contracts index.
- [x] Add `src/supply/{forecast,suppliers,dependency}.ts` with typed exported `forecastInventory`, `matchSuppliers`, `importDependency` functions.
- [x] Extract shared `evaluateReplenishment` from `intelligence/scenarios.ts` into `intelligence/replenishment.ts`; preserve twin outputs/version.
- [x] Run focused domain and existing scenario tests.

### Task 2: Extend persistence and authorization
- [x] Write failing disposable PostgreSQL tests in `test/supply-database.test.ts` proving migration, inventory ownership, child composite FKs, movement atomicity and protected supplier writes.
- [x] Extend `packages/db/src/schema/{private,reference}.ts`; generate migration and append RLS, invoker snapshot and atomic movement handling.
- [x] Inventory quantity remains current balance; inserted movements atomically update it, immutable ledger prevents accidental replay/edits. Explicit history start is required to interpret absent daily consumption as zero.
- [x] Run database tests under two authenticated identities and anonymous role.

### Task 3: Versioned APIs and integration
- [x] Write failing `test/supply-http.test.ts` and web wiring tests for authorization, validation, ownership and no-store/error handling.
- [x] Implement `src/supply/{http,rows}.ts` and server-only `apps/web/lib/backend/supply.ts` using JWT/RLS only.
- [x] Add `/api/v1/inventory` read/write, inventory movements/orders, `/api/v1/forecasts`, `/api/v1/suppliers/search`, `/api/v1/import-dependencies` API wrappers; response contracts validated server-side.
- [x] Scenario-linked forecasts use only owner-visible immutable snapshots, matching stock baseline and shared replenishment evaluation; do not mutate simulation or operational records.
- [x] Run focused HTTP/wiring tests.

### Task 4: Verification and internal specification
- [x] Run full recursive tests, lint, build, then uncached typecheck; review diff and generated schema consistency.
- [x] Review cross-boundary correctness/security and fix findings with regression tests.
- [x] Update internal specification with formulas, uncertainty, endpoints, data coverage, migration and observed checks. Mark limitations accurately and stop.

Verification owner: primary implementer. Evidence: exact fixture arithmetic plus actual disposable PostgreSQL roles/constraints/triggers; HTTP tests exercise real domain services; production build validates Next.js signatures. No frontend behavior change means browser/UI testing is not needed. Deployed Auth/network behavior and native multi-connection contention remain outside local evidence.

## Execution record

- Implemented inline in the supplied dirty workspace so pre-existing uncommitted backend work remained available; no work was stashed, reverted, committed or moved.
- Task 1: domain tests initially failed on absent implementations; consumption, forecast, supplier and HHI tests then passed. Future-receipt excess and arbitrary trade precision regressions reproduced and fixed.
- Task 2: PostgreSQL test initially failed on missing supply columns; generated `0005_chilly_thing.sql`, corrected generated composite-FK ordering, added invoker functions/RLS/triggers. Actual local roles verified isolation. A later account-erasure regression reproduced immutable-ledger cascade blocking; nested Auth cascade deletion now succeeds while direct owner edits/deletes remain blocked.
- Task 3: HTTP and actual Next.js wiring tests initially failed on absent handlers; domain/DB-backed handler and web wiring tests now pass. Removed accidental direct web Zod dependency and kept normalization in backend, consistent with repository package boundaries.
- Fresh independent code-reviewer found four Important issues, each reproduced RED → GREEN: impaired reservations, finite scenario demand horizon, changed scenario baseline, and known commitments despite unknown recurring demand. All are covered in final full-suite results. No Critical findings or deferred review minors were reported.
- Final checks: 121 passed, six opt-in network tests skipped; production build PASS; uncached lint/typecheck PASS; tracked diff whitespace check PASS (existing LF/CRLF warnings); offline schema generation reports no changes. No production claims or remote writes.
- Scenario forecasts require matching immutable network/stock/shipment/risk baselines; current orders/history and evaluation time are explicitly an overlay, not replayable persisted forecast results.

## Deliverable self-evaluation

Overall **4.0/5**: locally verified backend, with explicit operational activation limits.

| Axis | Score | Evidence / improvement |
| --- | --- | --- |
| Accuracy | 4 | 121 tests and four reproduced review regressions; forecasting intervals remain assumption-dependent, not calibrated probabilities. Validate on representative operational history before using service-level targets. |
| Completeness | 4 | All three capabilities, ownership and shared integration delivered; native multi-connection contention and deployed Auth remain unverified. Run authorized two-identity deployment checks. |
| Clarity | 4 | Internal spec gives formulas, payloads and limitations; some contract declarations remain compact to match existing style. A future API reference could improve discoverability. |
| Actionability | 4 | Migration and versioned handlers are ready for reviewed activation; production migration deliberately not applied without authorization. |
| Conciseness | 4 | User-facing delivery summary is short; plan and internal spec intentionally retain overlapping verification evidence for later maintainers. |

Highest-impact follow-ups are authorized deployed Auth/ownership verification, native concurrent-write testing, then curated country-identifier mapping. Would the user agree? Likely for backend-local delivery; this is not a production-readiness rating.
