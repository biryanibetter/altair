# ALTAIR Demo Mode Implementation Plan

## Overview
Create an isolated Demo Mode for the MES Youth Hackathon 2026 that allows judges to experience the full ALTAIR application without requiring:
- Supabase account/authentication
- Real database
- External API integrations (AIS, weather, LLM, etc.)
- Paid services

## Implementation Phases

### Phase 1: Demo Configuration & Data Layer
1. Create `apps/web/lib/demo/config.ts` - Demo mode configuration
2. Create `apps/web/lib/demo/data.ts` - Complete demo dataset (locations, products, suppliers, shipments, inventory, alerts, scenarios)
3. Create `apps/web/lib/demo/adapter.ts` - Demo data adapter that implements the same interfaces as the real backend
4. Create `apps/web/lib/demo/scenarios.ts` - Pre-built crisis scenarios

### Phase 2: Demo Mode Integration
1. Modify `apps/web/lib/supabase/server.ts` - Add demo mode bypass for Supabase config
2. Modify `apps/web/lib/supabase/auth.ts` - Add demo user for demo mode
3. Modify `apps/web/components/workspace/auth.tsx` - Add demo mode toggle/entry
4. Modify `apps/web/components/workspace/data.tsx` - Support demo data source
5. Modify `apps/web/components/workspace/shell.tsx` - Add demo mode indicator and reset button

### Phase 3: API Route Handlers for Demo Mode
1. Create `apps/web/app/api/v1/demo/route.ts` - Demo mode endpoint
2. Modify existing API routes to support demo mode where applicable
3. Add demo-specific endpoints for scenarios that need simulated responses

### Phase 4: Page-Level Demo Support
1. Overview page - Works with demo data
2. Shipments page - Works with demo data, create shipment flow
3. Route Planning - Works with demo data, route comparison
4. Inventory - Works with demo data, forecasts
5. Suppliers - Works with demo data, search
6. Alerts & Risk - Works with demo data, acknowledgment
7. Crisis Command - Works with demo scenarios, simulations
8. AI Assistant - Deterministic fallback when LLM unavailable

### Phase 5: Map & Visualizations
1. Ensure map works with demo locations and observations
2. Add demo mode indicator on map
3. Simulated vessel/aircraft positions

### Phase 6: Testing & Documentation
1. Create Playwright tests for demo journey
2. Run build, typecheck, lint
3. Test at 1440x900 and 1920x1080
4. Create `docs/internal/ALTAIR_DEMO_GUIDE.md`

## Demo Data Specification

### Locations (5-8 logistics hubs with real coordinates)
- Hamad Port, Qatar (51.55, 25.1)
- Hamad International Airport, Qatar (51.6, 25.27)
- Doha Distribution Hub, Qatar (51.5, 25.3)
- Jebel Ali Port, UAE (55.0, 25.0)
- Abu Dhabi Airport, UAE (54.65, 24.43)
- Sohar Port, Oman (56.62, 24.34)
- Bahrain Logistics Hub (50.55, 26.21)
- Kuwait Shuwaikh Port (47.95, 29.35)

### Transport Connections
- Sea: Jebel Ali → Hamad Port (36h, $500)
- Sea: Sohar → Hamad Port (24h, $400)
- Land: Jebel Ali → Doha Hub (20h, $900)
- Air: Abu Dhabi → Hamad Airport (5h, $2000)
- Air: Bahrain → Hamad Airport (1.5h, $1500)

### Shipments (7-10)
- Active shipments with tracking, milestones, various statuses
- At least one delayed shipment for exception demo
- One with route request saved for route planning demo

### Products (10-15)
- Essential equipment categories for Qatar import scenario

### Suppliers (5-8)
- Fictional suppliers with realistic profiles
- Match evidence for demo searches

### Inventory (2-3 storage locations with stock)
- Meaningful stock levels and consumption history
- Shortage scenarios for crisis demo

### Alerts & Scenarios
- Pre-configured alerts for demo
- Pre-built crisis scenarios (transportation disruption, supplier unavailable, etc.)

## Technical Approach

### Demo Mode Detection
- Use `NEXT_PUBLIC_DEMO_MODE=true` environment variable
- Server-side enforcement via middleware
- Client-side detection via context

### Data Isolation
- Demo data never written to production database
- Demo session state in localStorage/sessionStorage
- Reset action clears demo state

### API Response Contracts
- All demo responses follow existing Zod schemas
- Clear labeling of simulated vs real data
- Deterministic engines used where possible