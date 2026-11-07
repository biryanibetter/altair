# ALTAIR backend setup

The Next.js server lives in `apps/web`; Drizzle schema and versioned SQL migrations live in `packages/db/drizzle`. `packages/shared/src/contracts` contains Zod contracts and inferred types. `packages/backend` contains reusable provider ingestion and API services. `GET /api/v1/health` returns 200 when `SELECT 1` succeeds, otherwise 503. Task 002 architecture, API contracts, integration status and operational instructions are maintained in `docs/internal/ALTAIR_BACKEND_SPEC.md`.

## Configuration

The ignored root `.env.local` is for the Drizzle CLI; the ignored `apps/web/.env.local` is for Next.js. Both are already created with the supplied project details. Replace **only** `YOUR-DATABASE-PASSWORD` in `DATABASE_URL` in both files with the Supabase database password, URL-encoding any special characters in the password. `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` are for server-side Auth. The `SUPABASE_SECRET_KEY` is server-only and is not used by the web application yet; never expose it through `NEXT_PUBLIC_*` or commit either local env file. `.env.example` has placeholders only.

The direct database host resolves to IPv6 only and port 5432 was unreachable from this machine. The local files therefore use the reachable IPv4 Session Pooler endpoint for the region inferred from AWS's published IP range (`ap-northeast-1`). **Before migrating, confirm the exact Session Pooler URI under Supabase Dashboard → Connect → Session pooler**: host, port 5432 and username `postgres.<project-ref>` must match the project. Replace the URI if the dashboard differs; authentication cannot be checked until the password is supplied. `postgres` driver disables prepared statements for pooler compatibility.

## Commands

```text
pnpm install
pnpm --filter @altair/db db:generate    # generate reviewed SQL, no database writes
pnpm --filter @altair/db db:migrate     # ONLY after inspecting target and migration SQL
pnpm -r --if-present test
pnpm lint
pnpm typecheck
pnpm build
```

The initial migration creates new tables, foreign keys, checks, indexes and policies; it does not drop or rewrite existing tables. Run it only after confirming the target database and backing up any existing data. Never use `drizzle-kit push` against a shared database. For database-level RLS verification, use a disposable Supabase test project with two Auth users and `anon`/`authenticated` roles; unit tests alone do not prove remote policies were applied.

## Access boundary

Public catalog/intelligence tables (`organizations` is a directory, **not** a tenant) are readable by signed-in users, writable only by trusted backend processes. Private tables carry `owner_id` linked to `auth.users`; RLS filters reads and writes to `auth.uid()`, and composite keys prevent linking another user's private rows. Server-side Drizzle uses a database owner connection that **bypasses RLS**; use it only for migrations, health and trusted ingestion. Future user-facing queries must use the Supabase client with the user's JWT, and derive ownership from a verified Supabase Auth user rather than client input. Do not put confidential suppliers in the shared `suppliers` catalog.

Demo mode is not a privileged database role. Use separately authenticated demo identities, insert **synthetic** private rows under their own user IDs, label them clearly in future UI, and never seed real users' records into a demo identity. No demo records or UI behavior are introduced by this task.
