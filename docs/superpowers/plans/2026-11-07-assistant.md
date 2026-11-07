# Task 007 Implementation Plan

> **For agentic workers:** Use executing-plans; implement inline and preserve existing work. No commits, pushes, remote migrations or deployments.

**Goal:** Authenticated, tool-driven decision support with OpenRouter free inference and independent deterministic engines.

**Architecture:** Provider-neutral bounded model interface; strict allowlisted tools dispatch to existing domain handlers/services under verified JWT/RLS. Model selects evidence fields and safe review actions, never authors unchecked calculations. Owner-scoped PostgreSQL conversations and atomic request admission enforce privacy and quotas.

**Tech Stack:** Existing TypeScript, Zod 4, Next.js, Supabase, Drizzle, Vitest/PGlite; native fetch, no new dependencies.

**Spec:** User Task 007 requirements and `docs/internal/ALTAIR_BACKEND_SPEC.md` (complete Tasks 002–006 read).

## Global Constraints
- Server-only credentials; ignored root and web local env files; preserve unrelated changes.
- Default OpenRouter model `openrouter/free`; no paid fallback or provider-side tools.
- All tools use existing engines; no booking, procurement or operational mutation.
- No trust in retrieved text, historical conversation, model arguments or references.

## Review Focus
- Forged references and numeric claims: resolve exact fields from this request's successful tool results, not generated prose.
- Cross-owner conversation and record IDs: indistinguishable 404, actual PostgreSQL RLS tests.
- Free-provider 429/timeouts/malformed output: bounded attempts, sanitized errors and usable deterministic evidence.
- Multi-instance quota bypass: transactionally serialized per-user database admission.
- Prompt injection: untrusted tool/history roles, fixed server policy, no dynamic tools/URLs/owners.

### 1. Contracts and orchestration
- [x] Write failing Vitest tests for strict inputs, invalid tools, evidence selection, missing evidence, provider failure, limits and authorization.
- [x] Implement `contracts/assistant.ts`, `backend/src/assistant/{tools,provider,orchestrator,http,bounded}.ts`; existing schemas validate arguments/results. Evidence-backed output uses exact JSON pointers and server-controlled actions.
- [x] Run focused tests to green.

### 2. Persistence and HTTP wiring
- [x] Write failing PGlite tests for conversations, two owners, atomic admission and quota; web handler tests for auth/wiring.
- [x] Extend Drizzle schema/migration with private conversations/turns; bounded history and admission RPC. Add server-only web store, tool dispatch and `POST /api/v1/assistant/chat`.
- [x] Run database and web tests; offline schema generation only.

### 3. OpenRouter and verification
- [x] Mock HTTP tests: tools, zero-price routing, 429 Retry-After, bounded retries, timeouts, schema failure, credentials redaction.
- [x] Create/update ignored local configuration without logging secrets. Only use locally supplied key, never copy the exposed chat key.
- [x] Opt-in live free test attempted: skipped because both local files/process lack a key; no live reliability claim.
- [x] Run recursive tests, lint, build, post-build uncached typecheck and diff checks. Confirm deterministic engine tests with LLM disabled.
- [x] Update internal specification with observed results, provider limitations, activation gates; stop.

## Execution ledger / review

- Ruling: work inline in the existing workspace — Tasks 002–006 are substantial untracked/uncommitted user work, so a HEAD-based worktree would omit the services this task must integrate. Cost: changes remain combined in the user's dirty worktree; nothing is reset/staged/committed.
- Ruling: require current-request `approvedToolInputs` for assumption-bearing calculations — schema-valid model numbers are not user authorization. Return proposed inputs without execution. Cost: calculation requests need an explicit confirmation payload; lookup/default-only forecasts remain available.
- Ruling: prior stored responses are untrusted user history, not authoritative calculations — the owner can directly finalize their own turn via RPC, but no stored response is replayed as evidence or read into model context. Cost: a future history-display API must label this trust boundary or introduce server attestation before claiming verified replay.
- Independent read-only reviewer found model assumption laundering, untrusted-text finding laundering and tool execution consuming the persistence reserve. Each was reproduced failing, fixed and covered by green regressions. Completion persistence uses its own deadline/client; outstanding awaits and input-body consumption are bounded.
- Positive actual Next.js mock-provider dispatch and separate client/deadline tests close the review's web-wiring coverage gap. Dependency responses additionally expose the exact observation metadata used by the existing calculation; no second read or algorithm change.
- Deferred minor: PGlite serializes one connection; native multi-connection advisory-lock contention remains unverified.
- Final evidence: 177 tests passed, 7 skipped (6 existing public-provider cases + blocked OpenRouter live case); lint/build/post-build uncached types pass; offline generation reports no changes; ignored env files and browser credential-marker exclusion checked.

## Delivery self-evaluation

| Axis | Score | Evidence / improvement |
| --- | --- | --- |
| Accuracy | 4 | Real PGlite and domain pipeline tests pass; live OpenRouter model reliability cannot be claimed without a local key. |
| Completeness | 4 | All tools, private history and guards implemented; remote migration/Auth and live inference remain explicit activation gates. |
| Clarity | 4 | Contracts and internal API examples explain approvals; scalar field explanations favor safety over conversational fluency. |
| Actionability | 4 | Reproducible local/live commands and placeholders supplied; operator must supply a rotated key and authorize migration. |
| Conciseness | 4 | Focused modules with no new dependency or UI; confirmations add API verbosity deliberately. |

Overall **4.0/5**. Highest-impact follow-ups: run the synthetic live free-router test with a rotated local key; verify two deployed Auth identities and native concurrent quota requests after authorized migration. User agreement check: local implementation is verified, operational free-provider access is not.
