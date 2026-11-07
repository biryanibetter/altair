# ALTAIR Database Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Do not commit without authorization.

**Goal:** Provide an authenticated, user-isolated Supabase/Postgres backend foundation with shared reference data, safe migrations, contracts, a database health check, and tests.

**Architecture:** Keep the existing pnpm/Turbo/Next.js monorepo. Put Drizzle schema, SQL migrations, and database configuration in a focused backend workspace package; put Zod contracts in `packages/shared` without removing teammate changes; put server-only Supabase Auth integration and the health route under `apps/web`. RLS grants authenticated users read-only access to public reference records and restricts private rows by `auth.uid()`; trusted ingestion uses privileged server credentials only, never browser code. Demo mode uses synthetic records owned by separate demo identities, not a blanket RLS bypass.

**Tech Stack:** Next.js 15 App Router, TypeScript, pnpm workspaces, Supabase Auth/SSR, PostgreSQL, Drizzle ORM/Kit, Zod, Vitest.

**Spec:** User's access-model message in this conversation (2026-11-06) and Backend Task 001 request; no organization-based multi-tenancy or additional feature APIs.

## Global Constraints

- Do not change existing pages, components, styling, or frontend behavior; preserve concurrent working-tree changes.
- Never add credentials to Git, commit, push, deploy, or apply migrations to a database without checking connection target and obtaining permission for a production target.
- Shared reference records are authenticated-readable and trusted-backend-writable; private records are owner-only; demo data is synthetic and isolated.
- The requested `organizations` table is reference/catalog information, not an access-control tenant; leave future team sharing unimplemented.
- No product APIs beyond `GET /api/v1/health`; no AI, procurement, chat, or dashboard features.

## Review Focus

- Unauthenticated caller: cannot read shared reference data or private records (Task 2 policy tests).
- Cross-user direct and foreign-key access: cannot read or write another owner's private records, including cross-owner FK references (Task 2 policy tests).
- Shared data write attempt with publishable key: rejected even for authenticated user (Task 2 policy tests).
- Missing/invalid credentials: no secret disclosure and health reports unavailable rather than success (Tasks 1 and 4 tests).
- Demo identity: synthetic fixtures cannot expose real user-owned records (Task 2 policy tests, Task 5 docs).

---

### Task 1: Backend Workspace and Secure Configuration

**Files:** Create `packages/db/package.json`, `packages/db/tsconfig.json`, `packages/db/drizzle.config.ts`, `packages/db/src/env.ts`, `packages/db/src/client.ts`, `packages/db/test/env.test.ts`; modify `pnpm-workspace.yaml` only if required, `.env.example` (preserve current content), `.gitignore` (only if a specific env file is not covered), `pnpm-lock.yaml` via pnpm.

**Interfaces:** Produce `getDatabaseUrl(): string`, `getDatabase(): DrizzleClient` with server-only, lazy initialization; migration CLI scripts `db:generate` and `db:migrate` using versioned SQL migrations. Do not use a service-role key in browser-visible variables.

- [ ] Write env tests: missing/invalid URL fails without echoing its value; valid `postgresql:` or `postgres:` URL succeeds; no connection occurs on module import.
- [ ] Run focused test, confirm red; add minimal dependencies and implementation; rerun green.
- [ ] Verify `pnpm --filter @altair/db typecheck` and check that no actual secrets or local env files are tracked.

### Task 2: Schema and SQL RLS Migration

**Files:** Create focused `packages/db/src/schema/{reference,private}.ts`, `packages/db/drizzle/0000_*.sql` and Drizzle journal/meta; create `packages/db/test/schema.test.ts`, `packages/db/test/rls.integration.test.ts` (skip integration only when local test database is not configured).

**Interfaces:** Export Drizzle tables for `organizations`, `locations`, `transport_connections`, `products`, `suppliers`, `shipments`, `inventory`, `risk_signals`, `disruptions`, `route_options`, `scenarios`, `alerts`, and `data_sources`. Add owner_id referencing `auth.users(id)` to private tables; shared tables contain no owner-based permissions. Foreign keys across private tables must include owner matching where applicable, not merely a row-id reference. Use UUID primary keys, timezone-aware timestamps, constrained numeric quantities/costs, appropriate unique/indexed keys and `updated_at` strategy documented in schema.

- [ ] Write failing schema assertions for expected tables, owner columns, FKs, uniqueness, and nonnegative/check-constrained fields; integration tests for `anon`, two distinct authenticated users, and trusted service writes.
- [ ] Run focused tests, confirm red; create Drizzle schema and generate/review additive SQL; extend migration with explicit grants, RLS enablement and policy statements (without `db:push`).
- [ ] Run focused tests and static migration validation; run integration tests and `db:migrate` only against a specifically configured disposable/local Supabase database, otherwise report blocked.

### Task 3: Shared Contracts and Auth Infrastructure

**Files:** Modify `packages/shared/package.json` and existing entrypoint only as needed without deleting concurrent work; create `packages/shared/src/contracts/{reference,private}.ts`, `packages/shared/test/contracts.test.ts`; create `apps/web/lib/supabase/server.ts`, `apps/web/lib/supabase/auth.ts`, `apps/web/lib/supabase/auth.test.ts`; modify `apps/web/package.json` and lockfile.

**Interfaces:** Zod schemas and inferred TypeScript types for core public reference/private DTOs, not a new API. `createSupabaseServerClient()` and `getAuthenticatedUser()` use the publishable key and validated server-side user retrieval; cookie refresh is handled only in a writable response context. Never expose privileged database credentials to the client.

- [ ] Write failing contract and auth tests: valid/invalid payloads; signed-out user rejected; signed-in identity verified server-side; malformed config fails safely.
- [ ] Run focused tests, confirm red; implement server-only utilities and shared exports, then rerun green.
- [ ] Verify web and shared typechecks and ensure unchanged UI files.

### Task 4: Health Route and Backend Documentation

**Files:** Create `apps/web/app/api/v1/health/route.ts`, `apps/web/app/api/v1/health/route.test.ts`, `docs/backend-setup.md`; update backend environment instructions in `.env.example` if not already done.

**Interfaces:** `GET /api/v1/health` runs a lightweight read-only `SELECT 1`, responds `{ status: 'ok', database: 'connected' }` with HTTP 200 or `{ status: 'unavailable', database: 'disconnected' }` with HTTP 503, without credentials/error details; disable caching. No authentication needed for health.

- [ ] Write failing route tests for success, connection failure, missing config and no leaked secrets; run red.
- [ ] Implement route and concise setup instructions: Supabase project URL and publishable key, server-only database URL, migration target warning, local test database requirements, synthetic demo-user isolation, and command sequence; run focused tests green.
- [ ] Run `pnpm lint`, `pnpm typecheck`, `pnpm test` where available, `pnpm build`; report actual results, migrations run/not run, and configuration blockers. Review diff for frontend files and accidental credentials.
