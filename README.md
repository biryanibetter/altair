# ALTAIR

AI-powered supply chain intelligence and crisis management platform for Qatar logistics operations

## Technology Stack

- **Monorepo**: Turborepo + pnpm workspaces
- **Frontend**: Next.js 15 (App Router) + React 19 + TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui (to be added)
- **Validation**: Zod
- **Testing**: Vitest
- **Code Quality**: ESLint + Prettier
- **CI/CD**: GitHub Actions

## Repository Structure

```
altair/
├── apps/
│   └── web/              # Next.js application
├── packages/
│   ├── ui/               # Shared UI components
│   ├── shared/           # Shared types, utilities, schemas
│   ├── eslint-config/    # Shared ESLint configuration
│   └── tsconfig/         # Shared TypeScript configurations
├── .github/
│   └── workflows/        # GitHub Actions CI
├── .env.example          # Environment variable template
├── package.json          # Root package.json
├── pnpm-workspace.yaml   # pnpm workspace config
├── turbo.json            # Turborepo config
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 11.5+

### Installation

```bash
# Clone the repository
git clone https://github.com/<your-username>/altair.git
cd altair

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local

# Start development server
pnpm dev
```

The application will be available at `http://localhost:3000`.

## Available Commands

| Command | Description |
|---------|-------------|
| `pnpm install` | Install all dependencies |
| `pnpm dev` | Start all development servers |
| `pnpm build` | Build all packages and apps |
| `pnpm lint` | Run ESLint across the monorepo |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm test` | Run tests |
| `pnpm format` | Format code with Prettier |

## Development Workflow

### Branch Naming Convention

- `feat/dashboard` — Dashboard & UI work
- `feat/route-engine` — Route optimization engine
- `feat/crisis-intelligence` — Crisis simulation & data
- `feat/api-integration` — Backend & API integration

### Pull Request Process

1. Create a feature branch from `main`
2. Make changes with clear, atomic commits
3. Run `pnpm lint`, `pnpm typecheck`, and `pnpm test` locally
4. Open a Pull Request to `main`
5. Ensure CI passes and at least one teammate reviews
6. Merge after approval

### Shared Files (Coordinate Before Modifying)

- `packages/shared/src/**` — Types, schemas, utilities
- `packages/ui/src/**` — Shared components
- `apps/web/tailwind.config.ts` — Design tokens
- `.github/workflows/ci.yml` — CI configuration
- `turbo.json` — Build pipeline
- Root `package.json`, `pnpm-workspace.yaml`

## Environment Variables

Copy `.env.example` to `.env.local` and configure:

```bash
NEXT_PUBLIC_APP_NAME=ALTAIR
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_ENABLE_MOCK_DATA=true
```

## Team Collaboration

### Developer Responsibilities

| Developer | Focus Area |
|-----------|------------|
| Dev 1 | Frontend & UX (Dashboard, navigation, design system) |
| Dev 2 | Logistics & Route Engine (Routing, optimization, simulation) |
| Dev 3 | Crisis Intelligence & Data (Risk, shortage prediction, suppliers) |
| Dev 4 | Backend & Integration (API contracts, AI infrastructure, deployment) |

### Getting Started as a Teammate

```bash
# 1. Clone the repo
git clone https://github.com/<org>/altair.git
cd altair

# 2. Install dependencies
pnpm install

# 3. Create feature branch
git checkout -b feat/your-feature-name

# 4. Start developing
pnpm dev
```

## Future Development (Planned)

- PostgreSQL/Supabase integration
- AI provider integration (OpenAI, Anthropic)
- Geospatial libraries (Mapbox, Leaflet)
- External logistics APIs (MarineTraffic, AviationStack)
- Real-time data feeds
- Authentication (Better Auth)
- Digital twin simulations

## License

Proprietary — Qatar Hackathon Project
