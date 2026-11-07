<div align="center">

<pre>
 █████╗ ██╗  ████████╗ █████╗ ██╗██████╗
██╔══██╗██║  ╚══██╔══╝██╔══██╗██║██╔══██╗
███████║██║     ██║   ███████║██║██████╔╝
██╔══██║██║     ██║   ██╔══██║██║██╔══██╗
██║  ██║███████╗██║   ██║  ██║██║██║  ██║
╚═╝  ╚═╝╚══════╝╚═╝   ╚═╝  ╚═╝╚═╝╚═╝  ╚═╝
</pre>

<h2>Supply chain intelligence for an unpredictable world.</h2>

<p><em>AI-powered logistics, crisis response, and supply chain resilience.</em></p>

<p>MES Youth Hackathon 2026 · Smarter Qatar</p>

</div>

---

## About

ALTAIR is a supply chain intelligence platform designed to help businesses, industries, and essential service providers in Qatar navigate logistics disruptions and make better supply chain decisions.

International shipping is vulnerable to geopolitical conflicts, trade restrictions, rising transportation costs, and unexpected shortages. When established supply routes become unreliable, finding alternatives can be expensive, time-consuming, and difficult.

ALTAIR aims to bring logistics intelligence, predictive analytics, and scenario planning into one platform, helping organizations evaluate their options and respond to disruptions more effectively.

## The seven workspaces

The web app is a single, owner-scoped B2B shipping workspace. Every screen is wired to the same versioned `/api/v1` backend; there are no mock-data screens.

| Workspace | What it does |
| --- | --- |
| **Overview** | Map-first operations view: catalog geography, attributed vessel/aircraft observations, shipment exceptions, open alerts and risk signals. |
| **Shipments** | Owner-scoped shipment lifecycle with an immutable audit trail: milestones, notes, reroute requests, partner responses, saved routes and replenishment verification. |
| **Route Planning** | Server-side route comparison across land, sea and air with cost/duration/risk/confidence, returned geometry, coverage limits and rejection reasons. |
| **Inventory** | Stock records, reservations, movements, orders and demand forecasts with explicit assumptions, uncertainty and lead-time risk. |
| **Suppliers** | Evidence-based supplier catalog search with match status, source links and availability always shown as unverified. |
| **Alerts & Risk** | Monitoring configuration, evaluation, alert acknowledgement/resolution, attributed environment observations and the risk register. |
| **Crisis Command** | Deterministic scenario simulations, digital-twin comparison, risk register, data readiness, and import-dependency / compliance assessment. |

A global command palette (<kbd>Ctrl</kbd>+<kbd>K</kbd>) and an AI assistant drawer sit above the workspaces. The assistant answers only from approved tool output and never invents operational records.

## Design and implementation

- Neutral-first theme: `#080808` base, `#0A0A0A` sidebar, `#101010` surface, `#242424` borders, `#EDEDED` text. Colour is reserved for semantics.
- Geist Sans for interface text and Geist Mono for IDs, coordinates and metadata, loaded through `next/font`.
- Dense, flat, 1–4 px radii, 1 px dividers, minimal shadow and restrained motion with `prefers-reduced-motion` support.
- shadcn/ui primitives with one customized theme; MapLibre GL JS and the OpenFreeMap `liberty` style for maps.
- Next.js 15 App Router, React 19, TypeScript, Zod contracts, Tailwind CSS, Supabase cookie auth, pnpm workspaces and Turborepo.

## Repository layout

```
apps/web                 Next.js workspace UI and /api/v1 route handlers
packages/backend         Routing, risk, scenario, supply, monitoring, assistant engines
packages/db              Drizzle schema, SQL migrations and local database tests
packages/shared          Versioned Zod contracts and shared types
packages/ui              Shared UI primitives
docs/                    Public setup docs, internal architecture notes and design reviews
```

## Running locally

Prerequisites: Node 22 (`>=22 <23`), pnpm 11, and a Supabase project if you want authenticated screens.

```bash
pnpm install
cp .env.example .env.local          # root: Drizzle CLI
cp .env.example apps/web/.env.local # web: Supabase variables + DATABASE_URL
pnpm --filter @altair/web dev       # http://localhost:3000
```

The app needs `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` in `apps/web/.env.local` before the sign-in form renders. Any value marked server-only (`SUPABASE_SECRET_KEY`, `DATABASE_URL`, `INGESTION_SECRET`, provider keys, `OPENROUTER_API_KEY`) must never reach the browser or carry a `NEXT_PUBLIC_` prefix.

`GET /api/v1/health` reports `database: connected | disconnected`. A `503` means the configured database is unreachable; the UI surfaces that instead of inventing records.

## Verification status

Verified locally on Node 22.23.4:

- `pnpm --filter @altair/web typecheck` — pass.
- `pnpm --filter @altair/web lint` — 0 errors (one pre-existing unused-import warning in the teammate dropdown primitive).
- `pnpm --filter @altair/web build` — pass, 17 routes, ~419 kB first load including MapLibre.
- `pnpm --filter @altair/web test` — 26/26 pass.
- `pnpm --filter @altair/backend test` — 145 pass, 7 live tests skipped.
- Unauthenticated `/api/v1/shipments` returns `401`; `/api/v1/health` honestly reports the local database as disconnected.

Not yet verified:

- An authenticated browser journey against a live database and real Supabase account.
- Hosted migration activation. `packages/db/drizzle/0009_shipping_lifecycle.sql` is local only; the hosted database has **not** been migrated.
- Live provider feeds (HeiGIT/HERE, AISStream, OpenSky, GDELT, Comtrade) and live LLM inference. Unconfigured providers are shown as configuration states, not simulated data.

No freight booking, customs filing, duty calculation or legal determination is performed.

## Project Scope

- **Visibility** — Provide a clearer understanding of logistics networks, vulnerabilities, and disruptions through centralized intelligence.
- **Optimization** — Help organizations evaluate transportation and procurement alternatives while balancing cost, delivery time, and reliability.
- **Resilience** — Strengthen preparedness by exploring alternative suppliers, transportation strategies, and crisis response scenarios.

## Our Vision

To make supply chains more intelligent, adaptable, and resilient through accessible technology and data-driven decision-making.

ALTAIR is built around the idea that organizations should be able to anticipate challenges, understand their alternatives, and make informed decisions even when global supply networks face uncertainty.

## The Team

ALTAIR is developed by a **three-member student team** participating in the **MES Youth Hackathon 2026**, under the **Smarter Qatar** challenge.

Our goal is to explore how artificial intelligence, logistics intelligence, and practical innovation can contribute to a smarter and more resilient Qatar.

---

<div align="center">

<p><strong>ALTAIR</strong></p>

<p><em>Intelligence that keeps supply moving.</em></p>

<p>MES Youth Hackathon 2026 · Smarter Qatar</p>

</div>
