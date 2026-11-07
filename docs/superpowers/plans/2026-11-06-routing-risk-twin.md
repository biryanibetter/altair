# Routing, Risk and Digital Twin Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans task-by-task. User approved the architecture and requested implementation now; no further design-approval pause. Track progress below. No commits.

**Goal:** Deliver authenticated deterministic route comparison, then private reproducible disruption simulation.

**Architecture:** Shared validated contracts, pure backend calculations, existing PostgreSQL catalogs and owner-scoped snapshots, thin server-only Next.js handlers. Task 003 must pass its gate before Task 004 starts.

**Tech Stack:** TypeScript, Zod 4, Drizzle/PostgreSQL, Supabase user-JWT/RLS, Vitest/PGlite, Next.js.

**Spec:** `docs/superpowers/specs/2026-11-06-routing-risk-twin-design.md`

## Global Constraints

Preserve frontend and all unrelated work. No commits, pushes, deployment, real migrations or paid provider calls. No LLM calculations, invented connections or quotations. Unknown data remains unavailable. Hypothetical demonstrations require opt-in. No simulation writes to operational records.

## Review Focus

1. Missing/mixed-currency costs must not become comparable zero totals.
2. Search truncation must be explicit; priority changes cannot change discovered candidate coverage.
3. Missing operational metadata must be conditional, not evidence of availability.
4. Private snapshot creation must be consistent and execution must not reread changing operational data.
5. Cross-owner IDs, duplicate/conflicting modifications and unsupported engine versions must fail closed.

## Task 003: routing (complete and validate before Task 004)

### 1. Contracts and pure engine
Files: shared `contracts/routing.ts`, backend `routing/{engine,money,demo}.ts`, backend `test/routing.test.ts`.
Interfaces: `compareRoutes(network: Network, request: RouteRequest, evaluatedAt: string): RouteComparison`; `networkSchema`, `routeRequestSchema`, `routeComparisonSchema` exported from shared contracts.
- [x] Write failing directed graph, disconnected, conditional constraints, exact-cost, mixed-currency, priority, Pareto and bounded-search tests; run Vitest and observe failure.
- [x] Implement strict versioned schemas, fixed-point monetary arithmetic, bounded uniform-cost simple-path enumeration, feasibility, aggregation and stable explainable ranking.
- [x] Run focused tests and typecheck; add clearly hypothetical Qatar fixture with no geometry fabricated.

### 2. Persistence, adapters and authenticated HTTP
Files: db `schema/reference.ts`, generated migration; backend `routing/{providers,http,rows}.ts`; web `lib/backend/routing.ts`, `app/api/v1/routes/compare/route.ts`; focused backend and web tests.
Interfaces: `createRouteHandler(authorize)`; `networkFromRows`; `enrichConnection` provider adapter returns available/unavailable/unconfigured, never freight availability.
- [x] Write failing schema/migration, adapter missing-data and handler authorization/input tests.
- [x] Extend locations and connections with nullable coordinates and validated metadata. Add a bounded invoker-rights network snapshot RPC; preserve legacy rows as conditional with missing provenance.
- [x] Implement documented HERE road and maritime adapter boundaries, fixed provider endpoints and typed normalization; no live paid calls.
- [x] Wire verified Supabase identity to the consistent snapshot RPC and compare handler; use strict size limits/no-store/sanitized errors.
- [x] Run routing, adapter, HTTP and actual route wiring tests, disposable PostgreSQL migration/RLS tests, recursive tests, lint, typecheck and build. Review changes and record Task 003 gate evidence before starting Task 004.

## Task 004: risk and simulation (blocked until preceding gate)

### 3. Risk contracts and rules
Files: shared `contracts/intelligence.ts`, backend `intelligence/risks.ts`, db risk schema extension and migration, backend risk tests.
Interfaces: `normalizeRisks` using explicit target mappings and `riskExposure(signals, targets, evaluatedAt)`; `GET /api/v1/risks`.
- [x] Write failing severity/rule/target/staleness/deduplication and news-not-closure tests.
- [x] Implement versioned targeted weather, transportation, supplier and news signals with evidence, confidence and potential/confirmed distinction. Risk exposure never changes operational availability.
- [x] Test normalization and route exposure integration with legacy and unavailable evidence.

### 4. Snapshot-backed scenarios and APIs
Files: shared `contracts/scenarios.ts`; backend `intelligence/{scenarios,http}.ts`; db `schema/private.ts`, generated migration with snapshot creation/run persistence RPCs; web `lib/backend/scenarios.ts`, scenarios and risks API route files; backend/db/web tests.
Interfaces: `simulateScenario(snapshot, input, engineVersion)` pure result; authenticated creator-only create/list/read/execute/compare handlers. Snapshot stores immutable inputs/hash/time/version; one idempotent output per scenario/version.
- [x] Write failing closure, simultaneous disruption, every supply modification, conflict/unit, snapshot immutability and deterministic-replay tests.
- [x] Implement validated snapshot-only copy-on-write transformations and supply balances with explicit demand/replenishment assumptions. Return unavailable metrics instead of manufacturing missing inputs.
- [x] Add consistent invoker-rights snapshot capture and immutable engine snapshots/runs; preserve legacy scenario records; enforce RLS and owner-matched keys.
- [x] Wire bounded authenticated APIs; mask other-owner scenarios as 404, sanitize errors and validate stored contracts/versions.
- [x] Run PGlite two-owner isolation, immutability, concurrency/idempotency and local HTTP hypothetical Qatar create → execute → compare tests (multi-connection production contention remains unverified).

### 5. Delivery gate
- [x] Run all recursive tests, lint, typecheck and production build. Review diff and security boundaries, preserving frontend files.
- [x] Update `docs/internal/ALTAIR_BACKEND_SPEC.md` with API contracts, rules, limits, assumptions, provider availability, migration names, exact verification outcomes and deployment gates. Stop without commit/push/deploy.
