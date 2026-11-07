# ALTAIR — audit and visual review

Date: 2026-11-07. Scope: repository audit, baseline, and twelve isolated visual studies. **Premium visual direction approved; implementation and local verification completed on `feat/enterprise-shipping-integration`. Hosted activation, PR and merge remain unauthorized.**

## Work checklist

- [x] Locate repository, inspect instructions, README, internal handoff and actual source.
- [x] Fetch branches without checkout/merge and compare teammate contributions.
- [x] Run Node 22 frozen installation and offline tests.
- [x] Complete uncached lint, production build and typechecking.
- [x] Smoke-test ingestion CLI startup with an invalid job (no ingestion).
- [x] Check local backend health and record database accessibility.
- [x] Replace the first-pass twelve-screen navigation proposal with five revised priority screens, two additional main-page previews, contextual flows, Crisis tabs and global command palette; browser-inspect the five screenshots.
- [x] Present visual review and obtain explicit approval.
- [x] After approval: implementation plan, isolated integration, domain work and staged checks.
- [ ] Authenticated browser journey against a live database and test account.
- [ ] Hosted migration/RLS activation, PR review and main merge (separately authorized).

## Repository evidence

Repository: `biryanibetter/altair`. Initial checkout: clean `main`, `668de92`, matching fetched `origin/main`. Teammate branch: `origin/feat/aiden-altair-ui`, `e30a42e`, one UI commit, 51 changed files, 8,942 insertions and 73 deletions relative to merge base `0119098`. No other remote feature branches were returned by fetch. No checkout, merge, reset, stash, staging, commit, push or deletion performed.

Read the five requested internal documents and the Task 010 additions. Several older sections still describe absent selectors, broken CLI startup and CI without tests; these are superseded by current code. Current CI includes offline tests. Current contracts include product/location/warehouse selectors and shipment create/list/detail. Source and fresh commands take precedence over historical documentation.

### Backend capability map

| Capability | Existing implementation | Integration boundary |
|---|---|---|
| Directed multimodal routing | `packages/backend/src/routing/engine.ts`; bounded simple-path search, feasibility, Pareto and weighted ranking | Preserve engine; ranking is over evaluated candidates, not guaranteed global optimum. Unknown duration/cost/risk and missing geometry stay unknown. |
| Exact financial totals | `routing/money.ts`, BigInt-scaled amounts and per-currency aggregation | No currency conversion or carrier quotations. |
| Risk intelligence | `intelligence/risks.ts`, structured targeted signals and weather rules | News is potential evidence, never automatic confirmed closure. |
| Digital twin | `intelligence/scenarios.ts`, immutable owned baseline, deep-copy changes, canonical hashes, fixed engine versions | Preserve replay and baseline integrity; simulation never changes operational records. |
| Forecasting | `supply/forecast.ts`, consumption/history/commitments/eligible receipts | Missing demand or lead times remain unknown; assumptions must be explicit. |
| Suppliers and import dependencies | `supply/suppliers.ts`, `dependency.ts`, trusted catalog evidence and historical trade | Catalog match does not confirm stock; imports do not establish national completeness. |
| Monitoring and alerts | `monitoring/`, owner-scoped config/evaluation, persisted episode transitions | Realtime/scheduling activation and real deployed delivery are unverified. |
| AI | `assistant/`, allowlisted tools, exact assumption approvals and evidence-backed output | Optional model; local key absent; deterministic tools remain independent. |
| Shipment persistence | `integration/http.ts`, web integration store, shared `integration.ts` | Planned shipment create/list/read exists; it is not a shipping-order lifecycle or booking. |
| Inventory | Drizzle private models, immutable movements, reservations, planned demand orders | Existing `planned_orders` are inventory commitments, not B2B shipping orders. Do not conflate them. |
| Auth and ownership | Supabase SSR server verification and refresh middleware; owner-qualified RLS/FKs | Missing browser sign-in/callback and real two-user hosted verification. Ownership is per user, not shared business tenancy. |

Database source: 25 application tables, nine journaled migrations. No remote migration applied. Shipment statuses currently allow planned/in_transit/delivered/delayed/cancelled; they do not encode quotation, draft-order or reroute approvals. There are no persisted tracking milestones, quote requests, shipping-order transition audit records or reroute approvals in the inspected model. Extend shared contracts/models additively after approval rather than faking these in UI state.

### Teammate review and preservation plan

| Area | Evidence / disposition |
|---|---|
| Reusable controls | Sixteen `components/ui` files use recognizable shadcn/Radix composition. Retain reviewed behavior, accessible primitives and attribution; adapt semantic tokens and sizing. |
| Navigation | Ten actual page destinations, collapsible sidebar, mobile Sheet and route-driven closing. Preserve interactions. Reorganize into Shipping / Intelligence and restore ALTAIR identity (current chrome says QATAR NSCL). |
| Maps | Two map implementations (`leaflet-fleet-map`, `tactical-fleet-map`) and vessel inspectors. Preserve useful selection, inspector and source-state ideas while using the required MapLibre/OpenFreeMap stack. |
| Functional interaction ideas | Supplier filters/RFQ dialog, tracking inspectors, route comparisons, crisis controls, inventory panels. Preserve workflow intent and useful controls. Reconnect to real contracts. |
| Mock state | `lib/store.ts` initializes mock shipments/alerts/metrics. Crisis toggle changes shipments to rerouted and declares closures, airlift and reserve release locally. Replace these semantics with isolated hypothetical scenario state; retain original commit in history. |
| Stub execution | Routes/inventory/suppliers import mock data; copilot, crisis and RFQ paths use timeouts/local state. No evidence these call the existing `/api/v1` domain services. Must not be presented as operational. |
| Provider duplication | New `lib/live` VesselAPI/DataDocked/AIS ingestion overlaps existing normalized provider pipeline and adds providers outside the approved list. Reuse existing ingestion contracts; do not enable these new dependencies. |
| Hosting concern | `/api/live/stream` starts a shared upstream AIS hub inside request handling with persistent intervals. Move continuous AIS to an appropriate worker after approval; no permanent Vercel-request WebSocket. |
| Access/quota concern | New live fleet/stream/vessel handlers lack the existing verified-user guard. `force=1` bypasses snapshot TTL; deployment rate controls need integration review. |
| Dependency blocker | UI commit adds imports without dependency manifest/lock updates: lucide-react, Radix packages, class-variance-authority, clsx, tailwind-merge, zustand, recharts, leaflet and ws. |
| Styling blocker | Branch CSS uses Tailwind 4 `@import` / `@theme`, while current workspace pins Tailwind 3. Current content config omits `apps/web/components`. Resolve deliberately; do not overwrite current root/config fixes. |
| Typography/hierarchy | 9–10px labels/buttons, fixed connected/live chrome, mixed names and decorative status colors need correction. Retain compact operational layout intent with readable 13–14px controls. |

**Safe later integration:** fetch again; create an integration branch/worktree from latest main. Record/review the complete teammate commit, merge its history with explicit conflict resolution, and reconcile the approved redesign in separate commits. Preserve current backend, CI, ESM boundary, workspace manifests and fixes. Track every changed teammate path as retained/adapted/replaced, not silently omitted. Stage only reviewed paths after secret scanning. PR and CI before merge; explicit main-merge permission and branch-owner cleanup permission remain required. No branch cleanup is authorized by this audit.

### Baseline

Runtime: existing local Node **22.23.4** explicitly prepended to PATH; pnpm **11.5.2**. System default Node 25.9.0 was not used for these checks.

| Check | Result |
|---|---|
| `pnpm install --frozen-lockfile` | PASS; lockfile unchanged, already up to date |
| Offline `pnpm -r --if-present test` | PASS: 184 tests; 7 opt-in skipped; shared 9, db 10, backend 144, web 21; 45 passing test files, 2 skipped |
| Unit/integration scope | Existing unit, disposable PostgreSQL/PGlite policy/trigger and loopback HTTP suites. SQL-shimmed users, not hosted Auth. No separate browser suite found. |
| CLI `ingest __audit_invalid_job__` | Expected exit 1 with usage; module startup passes; no provider/database writes |
| Uncached lint/build/typecheck | PASS: web ESLint one task; Next 15.5.28 optimized build 33 API paths + middleware; four TypeScript package tasks, after build |
| Local built HTTP | Public `/api/v1/health` 503 `database:disconnected`; protected `/api/v1/shipments` 401 without cookies. Remote database connectivity not established; no mutations attempted. |
| Existing browser tests | No Playwright config/test command found in main or teammate commit; Vitest web tests are API/Auth wiring |
| Live providers/LLM | Not run in this baseline; skips are not live passes |
| Hosted RLS/Auth/native concurrent DB | Not verified |

### Provider/configuration inventory

Presence-only checks of ignored root and web `.env.local` found DB URL, Supabase URL and publishable configuration. No values are reproduced. No openrouteservice/ORS, AISStream, OpenSky OAuth/token or OpenRouter key was found under the checked conventional names. Obtaining credentials externally does not mean this checkout is configured. Do not paste secrets into chat or Git.

Existing public adapters: Qatar Open Data, Comtrade, Open-Meteo weather/marine, GDELT. Existing optional adapters: OpenSky and bounded AIS collector. HERE/Searoutes are optional legacy enrichment, not required dependencies, and must stay disabled for this directive. An openrouteservice adapter is not present and needs an additive replacement enrichment path. OpenSky currently accepts an externally maintained access token, not client-credential refresh. AIS CLI is bounded, not a continuous supervised worker. Camera source validation exists but registry is empty and no authorized feed/read endpoint is connected. No carrier tracking API exists.

Current free-tier/commercial-use terms must be checked before enabling providers; this audit does not enable any. In particular, noncommercial demo eligibility is not permission to use a free weather service indefinitely for a commercial B2B deployment. Keep provider unavailable states usable. Approved basemap is OpenFreeMap; all route geometry must come from returned evidence, never illustrative connectors.

## Design specification for approval — revised by product owner

The initial request supplied the design direction. Five later supplied UI references show compact dark collaboration workspaces, dense explorer tables, split inspectors and a keyboard-first command palette. The original upload was an unrelated terminal screenshot and was not used as a visual reference. User correction subsequently prioritizes **Supabase and GitHub** over the original wider inspiration set.

**Locked information architecture:** seven main sidebar destinations only: Overview, Shipments, Route Planning, Inventory, Suppliers, Alerts & Risk, Crisis Command. No separate main-navigation destination for Tracking, Digital Twin, Monitoring, National Resilience, Cargo Compliance or AI Assistant. Shipment creation/detail belong under Shipments; monitoring under Alerts & Risk; twin/scenarios/resilience/compliance inside Crisis Command; assistant as a global command palette with an assistant overlay. The earlier first-pass renderer remains a visual utility only, not an implementation proposal. Present the corrected five priority screens for approval; auxiliary screen states illustrate embedded workflow details, not additional top-level pages.

**Design call:** one operational workspace centered on shipping. Overview is a large live-operations map with narrow contextual inspectors, not a second full shipments table. Each secondary page has one job: shipment lifecycle, route decisions, stock, sourcing, evidence/alerts, or advanced civilian resilience analysis. Neither the teammate's national-command-first layout nor the first-pass table-first overview is the approved direction. No decorative hero or rainbow KPI cards.

- Surface tokens, revised darker: base `#090a0c`, sidebar `#0b0c0f`, surface `#101215`, raised `#17191d`, border `#242830`, text `#e8ebf0`, secondary `#929aa7`. Restrained blue for selected actions; green/amber/red for operational meaning only.
- Geist (SIL Open Font License), 13px interface/table body, 12px secondary, 11px metadata, 17px section titles, 24px page title; tabular numerals. No microtype for essential actions.
- 4px spacing foundation; 216px sidebar, 48px header, 32–34px controls, 38–40px table rows, 320px inspector, 16–20px page padding, 6–8px corner radii. Sidebar contains logo, one workspace switcher, only seven page links, and one compact profile area. No promotional or duplicate context cards.
- Shared shell across all twelve studies; authentication retains brand/topbar geometry while presenting a public access state, not private records.
- Official shadcn implementation mapping: Button, Input, Label, Select/Combobox, Checkbox, Tabs, Badge, Separator, Table + TanStack Table, Sheet, Dialog, DropdownMenu, Command and Tooltip. Reuse teammate controls where suitable. Existing Tailwind 3 remains until a separately justified migration; no gratuitous framework upgrade.
- Mockups are static browser-rendered visual contracts, using shadcn-style semantic tokens/control anatomy. They are **not** production React/Radix components or connected backend functionality. Production implementation uses actual shadcn/Radix after approval.
- Every fixture screen is labeled “Design preview · illustrative data”. Maps are schematic, not navigational geometry. Routes/prices/ETAs are illustrative estimates, not quotes or live status. No provider activation or record writes occur.

### Five priority revised screens and embedded states

1. Overview: dominant map, route/shipment geography, relevant live layers when configured, freshness, a small exception queue and compact inspector. No full table or full inbox.
2. Shipments: searchable owned shipment table, selected detail inspector, Create Shipment flow, tracking milestones, owner/carrier attribution, reroute request state and audit history.
3. Route Planning: cargo and endpoint controls, alternative comparison table and substantial map; save preferred option or request a quotation/arrangement, never invent bookings.
4. Alerts & Risk: alert inbox plus monitored evidence and provider/freshness tabs for news, weather, marine, vessel and aviation observations; authorized-camera unavailable state. Evidence and alert actions stay together.
5. Crisis Command: tabs for Crisis overview, Digital Twin, disruption scenarios, national resilience and cargo compliance. Simulation remains hypothetical and isolated.

Inventory and Suppliers are additional required sidebar pages with distinct stock and sourcing responsibilities. The assistant belongs to the global command palette/drawer reachable from any page. Authentication is a separate public-state screen, never a sidebar destination. Earlier standalone renderers in `review.js` are **outdated** as navigation/IA proposals and should not be approved as separate pages. Production motion target: 100–140ms hover, 160–220ms inspectors/dialogs, 180–240ms navigation; respect reduced motion and show loading skeletons.

### Visual review evidence

`revised.html` was browser-rendered at 1440 × 900. Screenshots: `01-revised-overview.png`, `02-revised-shipments.png`, `03-revised-routes.png`, `04-revised-alerts.png`, `05-revised-crisis.png`. Five screenshots show exactly seven sidebar destinations and no redundant assistant, twin or monitoring page. Both browser JavaScript files pass `node --check`. Playwright navigation reported no JavaScript page errors across five screens. Browser interaction opened Crisis Digital Twin, National Resilience and Cargo Compliance tabs; switched Alerts Cameras and back to inbox; and opened/closed the global Ctrl+K command palette without reported failures. Captured media is design-only: the large SVG map is schematic and never a live provider response. Production MapLibre/OpenFreeMap and backend wiring are after approval only.

### Third visual direction — submitted for approval, NOT approved

The five `*-revised-*.png` files above are a **rejected prior proposal**. The current proposal is `revised.html` with `premium.css` and `premium.js`, plus `01-premium-overview.png` through `09-premium-digital-twin.png` (including the seven primary pages and a shipment-tracking state). The Overview now renders an actual OpenFreeMap `liberty` geographic basemap via MapLibre GL JS 5.19.0, recolors its vector layers in-browser, uses camera pitch 58° / bearing −22°, and preserves provider attribution. At regional zoom the map is perspective-capable but does not pretend to show terrain or 3D buildings; the optional extrusion layer only appears where building-height data and zoom support it. Illustrative vessel, aircraft, hub markers and the dotted endpoint relationship are expressly **not** live observations or navigational route geometry. Disabled camera/disruption controls never substitute fictional feed data. The same real basemap appears on Route Planning; other scenario graphs remain explicitly illustrative.

Geist Sans is loaded from the shared review CSS; Geist Mono is loaded from Google Fonts for IDs/numeric metadata. Browser computed family and `document.fonts.check` verified both. Palette is neutral-first with white primary actions; panels and tables are flat and joined. Seven sidebar destinations remain. This is an isolated static prototype: shadcn/ui customization, real APIs, backend integrations, authentication and production motion belong to the implementation **only after explicit visual approval**.

Compliance references and national resilience remain navigable contextual panels in the review; their implementation must retain existing scope and honest evidence limitations.

## Approval and next gate

Review visual hierarchy, typography, density, shell, map/table balance and all twelve screens. Approval authorizes the visual direction, not remote migrations, deployment, paid services, main merge or branch deletion. After approval, prepare the scoped implementation/test plan and proceed through the requested stages. README revision waits until implementation and verification.
