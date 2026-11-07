# Backend Ingestion Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Track steps below. User authorized execution without additional architectural questions; do not commit, push or deploy.

**Goal:** Establish reusable, observable provider ingestion with authenticated read APIs and inactive Supabase Cron preparation.

**Architecture:** Existing monolith, shared Zod contracts, Drizzle/PostgreSQL persistence. Bounded TypeScript services called from local CLI or secret-authenticated Next.js endpoints; reads use Supabase user JWT/RLS.

**Tech Stack:** TypeScript, Zod 4, Drizzle, PostgreSQL, Vitest, Next.js 15, Supabase Cron/Vault/pg_net.

**Spec:** `docs/internal/ALTAIR_BACKEND_SPEC.md`

## Global Constraints

Preserve frontend and all unrelated work. Keep Supabase user-based ownership/RLS. Never synthesize failed provider data. Keep credentials server-side. Do not activate production schedules or run remote migrations. No routing or AI.

## Review Focus

1. Overlapping and abandoned runs: leased token must fence stale completion and enable recovery.
2. Provider null/malformed data: reject invalid types and preserve last successful batch.
3. HTTP retry budgets and long Retry-After: persist deferral instead of sleeping beyond serverless budget.
4. Partial trade pages: cursor advances atomically; repeated ingestion must not duplicate data or claim completeness.
5. Forecast freshness and missing configuration: estimated/historical nature remains distinct from stale/unavailable.

## Tasks

### 1. Shared contracts and persistence
Files: shared `contracts/ingestion.ts`, db `schema/ingestion.ts`, `ingestion-store.ts`, generated migration and security SQL, focused tests.
- [x] Write contract/schema tests; run to establish failure.
- [x] Define Observation, ProviderStatus, Freshness and API envelope Zod schemas; export without changing existing contracts.
- [x] Add three tables, indexes, catalog SELECT policy, private operational state; trusted SQL repository with atomic claim/complete/fail APIs.
- [x] Run focused tests and local PostgreSQL integration checks.

### 2. Provider adapters and bounded orchestration
Files: `packages/backend/src/{providers,transport,ingestion,config,read}.ts`, package/test configuration, local CLI.
- [x] Write synthetic fixture tests for each provider and missing credentials/malformed/failure/retry cases; observe failure.
- [x] Implement `fetchJson`, `createJobs(env)` and `ingest(job, store)` with timeout, safe retries, rate-limit cooldown, persistent cursor and cache.
- [x] Prove deduplication, expired lease fencing, failed-write rollback, cache and stale behavior with actual local PostgreSQL.

### 3. HTTP and inactive scheduling
Files: `apps/web/lib/backend/*`, API routes, `packages/db/operations/ingestion-cron.sql`, CLI documentation/env placeholders.
- [x] Write handler tests for auth, unknown jobs, input validation, sanitized status and read retrieval; observe failure.
- [x] Implement thin handlers and user-JWT read service; no frontend changes.
- [x] Prepare inactive configurable Vault/pg_net scheduling template and local execution commands.

### 4. Evidence and delivery
- [x] Fetch accessible provider responses, validate/store in local PostgreSQL, retrieve through read handler; retain reproducible opt-in test.
- [x] Run `pnpm -r --if-present test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`.
- [x] Review diff/security boundaries, update the internal specification with exact provider/check results and remaining deployment gates. Stop.

## Execution ledger

Task 1: complete — shared/db tests observed missing-module failures, implemented contracts/schema, applied all migrations to disposable local PostgreSQL, tested roles/policies. No remote migrations.

Task 2: complete — provider tests observed failures, implemented adapters/transport/store. Real responses exposed ODS date filter/ISO serialization/page-sized grouped totals; regression tests failed before fixes. Added scope-fenced cache invalidation and explicit partition limits, no silent completeness claim.

Task 3: complete — handler tests failed before implementation; added Next.js route-wiring tests and disabled-scheduler execution test. No UI edits and no schedules activated.

Task 4: complete — 56 ordinary tests pass; 5 live pipelines pass. Full all-provider live suite remains 5 pass / 1 failure (GDELT timeout). Typecheck, lint and build pass. Fresh read-only reviewer found one Important precision defect, fixed with unsafe-integer/exponent test RED→GREEN; entire suite and five accessible live pipelines re-run after fix.

Ruling: Work in-place on the user's existing uncommitted foundation rather than a clean worktree — required existing backend dependencies are uncommitted and concurrent work must be preserved; cost is weaker commit-range isolation, mitigated by narrowly scoped files and no commits/resets.

Ruling: Use PGlite as a development-only PostgreSQL engine for local proof — no native PostgreSQL/Docker is installed and remote database changes were not authorized; cost is no proof of deployed Supabase Auth/Vault/pg_net or multi-connection scheduling, explicitly gated in the spec.

Ruling: Validate configuration lazily inside provider adapters instead of an unused central config module — missing Comtrade credentials must not block public providers; cost is per-provider validation responsibility.

Ruling: Default Qatar scope to verified 2024/HS10 and continue bounded grouped pages — the dataset does not contain 2025, and Explore limits offset access; cost is intentionally partial commodity coverage, explicit in API status/spec.

Final: fixed exact numeric precision — raw numeric tokens retained rather than rounded JSON numbers, exponent quantities expanded; regression RED→GREEN, whole suite 56 passing, accessible live pipelines 5 passing.

Final: minor (deferred): status-query latest-fetched index; actual multi-connection simultaneous-claim stress test; rejected-response body cleanup. Details and impact boundaries are in the spec.

## Delivery self-evaluation

Local backend infrastructure is evidenced; production integrations are deliberately not claimed.

| Axis | Score | Evidence / improvement |
| --- | --- | --- |
| Accuracy | 4/5 | Real HTTP/database proof and exact decimal regression; minimum Node 22 runtime was not separately exercised (local Node 25). |
| Completeness | 4/5 | All four adapters implemented; GDELT remains live-unverified and subscription Comtrade untested against real credentials. |
| Clarity | 4/5 | Canonical internal spec separates contracts/evidence/gates; long operational detail could later be split without creating a competing source of truth. |
| Actionability | 4/5 | CLI, env placeholders, inactive SQL template and reproducible tests provided; production deployment/auth validation remains necessary. |
| Conciseness | 4/5 | No frontend or unrelated feature work; spec retains substantial operational detail to avoid implied readiness. |

Overall: 4.0/5. Highest-impact follow-ups: verify GDELT from deployed egress; run real Supabase Auth/Cron/Vault smoke tests after authorization; add native multi-connection contention coverage. User would reasonably agree that local proof is strong but not a deployed readiness claim.
