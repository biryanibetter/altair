// ALTAIR Demo Mode Scenarios
// Pre-built crisis scenarios for demonstration

import { demoScenarios } from './data'
import { z } from 'zod'

// Scenario execution result type
export interface ScenarioResult {
  success: boolean
  scenarioId: string
  engineVersion: string
  evaluatedAt: string
  baseline: any
  simulated: any
  changes: any[]
  limitations: string[]
}

// Deterministic scenario execution for demo mode
export async function executeScenarioDemo(scenarioId: string): Promise<ScenarioResult> {
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 1500))
  
  const scenario = demoScenarios.find(s => s.id === scenarioId)
  if (!scenario) {
    throw new Error('Scenario not found')
  }
  
  // Return deterministic results based on scenario
  const baselineRoutes = [
    {
      id: 'route-1',
      modes: ['sea'],
      cost: { total: { amount: '500', currency: 'USD' }, complete: true },
      durationHours: { min: 36, max: 42 },
      risk: 0.3,
      confidence: 0.85,
      feasible: true,
    },
    {
      id: 'route-2',
      modes: ['land'],
      cost: { total: { amount: '900', currency: 'USD' }, complete: true },
      durationHours: { min: 20, max: 24 },
      risk: 0.2,
      confidence: 0.9,
      feasible: true,
    },
    {
      id: 'route-3',
      modes: ['air'],
      cost: { total: { amount: '2000', currency: 'USD' }, complete: true },
      durationHours: { min: 1.5, max: 2 },
      risk: 0.1,
      confidence: 0.95,
      feasible: true,
    },
  ]
  
  // Apply modifications to get simulated routes
  let simulatedRoutes = [...baselineRoutes]
  
  if (scenario.id.includes('gulf-disruption')) {
    // Arabian Gulf disruption - sea routes affected
    simulatedRoutes = simulatedRoutes.map(r => {
      if (r.modes.includes('sea')) {
        return {
          ...r,
          cost: { total: { amount: String(Math.round(Number(r.cost.total.amount) * 2.5)), currency: 'USD' }, complete: true },
          durationHours: { min: r.durationHours.min + 48, max: r.durationHours.max + 72 },
          risk: Math.min(0.9, r.risk + 0.5),
          confidence: r.confidence - 0.2,
        }
      }
      return r
    })
  } else if (scenario.id.includes('supplier-failure')) {
    // Supplier failure - primary supplier unavailable
    simulatedRoutes = simulatedRoutes.map(r => ({
      ...r,
      cost: { total: { amount: String(Math.round(Number(r.cost.total.amount) * 1.3)), currency: 'USD' }, complete: true },
      risk: Math.min(0.7, r.risk + 0.2),
    }))
  } else if (scenario.id.includes('demand-surge')) {
    // Demand surge - air freight prioritized
    simulatedRoutes = simulatedRoutes.map(r => {
      if (r.modes.includes('air')) {
        return {
          ...r,
          cost: { total: { amount: String(Math.round(Number(r.cost.total.amount) * 1.8)), currency: 'USD' }, complete: true },
        }
      }
      return r
    })
  }
  
  return {
    success: true,
    scenarioId,
    engineVersion: 'twin-2026.11',
    evaluatedAt: new Date().toISOString(),
    baseline: {
      routes: baselineRoutes,
      supply: [
        { productId: 'med-ventilators', available: '45', demand: '12', shortage: '0', complete: true, reasons: ['Adequate stock'] },
        { productId: 'patient-monitors', available: '120', demand: '15', shortage: '0', complete: true, reasons: ['Adequate stock'] },
        { productId: 'dialysis-machines', available: '8', demand: '12', shortage: '4', complete: false, reasons: ['Below reorder point', 'Lead time 45 days'] },
      ],
    },
    simulated: {
      routes: simulatedRoutes,
      supply: [
        { productId: 'med-ventilators', available: scenario.id.includes('supplier-failure') ? '15' : '45', demand: scenario.id.includes('demand-surge') ? '150' : '12', shortage: scenario.id.includes('demand-surge') ? '105' : (scenario.id.includes('supplier-failure') ? '0' : '0'), complete: !scenario.id.includes('demand-surge'), reasons: scenario.id.includes('demand-surge') ? ['Demand surge 300%', 'Insufficient supply'] : ['Adequate stock'] },
        { productId: 'patient-monitors', available: '120', demand: scenario.id.includes('demand-surge') ? '300' : '15', shortage: scenario.id.includes('demand-surge') ? '180' : '0', complete: !scenario.id.includes('demand-surge'), reasons: scenario.id.includes('demand-surge') ? ['Demand surge 300%', 'Insufficient supply'] : ['Adequate stock'] },
        { productId: 'dialysis-machines', available: '8', demand: '12', shortage: '4', complete: false, reasons: ['Below reorder point', 'Lead time 45 days'] },
      ],
    },
    changes: [
      { target: 'routes', reason: 'Sea routes disrupted, air alternatives prioritized' },
      { target: 'supply', reason: 'Demand surge exceeds available inventory' },
    ],
    limitations: [
      'Demo mode uses deterministic simulated data',
      'Real-time carrier quotes not available',
      'Weather and traffic data simulated',
      'Regulatory constraints not modeled',
    ],
  }
}

// Get all demo scenarios
export function getDemoScenarios() {
  return demoScenarios
}

// Create a new scenario in demo mode
export function createDemoScenario(input: any) {
  const newScenario = {
    id: `demo-scenario-${Date.now()}`,
    ownerId: 'demo-owner',
    ...input,
    createdAt: new Date().toISOString(),
    engineVersion: 'twin-2026.11',
    baselineReference: `baseline-${new Date().toISOString().slice(0, 10)}`,
    executed: false,
  }
  return newScenario
}

// Validate scenario input
export const scenarioInputSchema = z.object({
  name: z.string().min(1).max(200),
  routeRequest: z.object({
    originId: z.string().uuid(),
    destinationId: z.string().uuid(),
    preferences: z.object({
      modes: z.array(z.enum(['land', 'sea', 'air'])).min(1),
      allowHypothetical: z.boolean().optional(),
    }),
    constraints: z.object({
      maxHops: z.number().int().min(1).max(10).optional(),
      maxExpansions: z.number().int().min(1).max(5000).optional(),
      maxAlternatives: z.number().int().min(1).max(50).optional(),
      priorities: z.object({
        cost: z.number().min(0).optional(),
        time: z.number().min(0).optional(),
        risk: z.number().min(0).optional(),
      }).optional(),
    }).optional(),
  }),
  horizonHours: z.number().positive().max(8760).optional(),
  modifications: z.array(z.object({
    kind: z.enum(['connection', 'supplier_unavailable', 'inventory_reduction', 'demand_increase', 'replenishment_delay']),
    edgeId: z.string().uuid().optional(),
    closed: z.boolean().optional(),
    capacityFactor: z.number().optional(),
    costFactor: z.number().optional(),
    timeFactor: z.number().optional(),
    supplierId: z.string().uuid().optional(),
    inventoryId: z.string().uuid().optional(),
    quantity: z.string().optional(),
    productId: z.string().uuid().optional(),
    unit: z.string().optional(),
    shipmentId: z.string().uuid().optional(),
    delayHours: z.number().optional(),
  })).optional(),
  demand: z.array(z.object({
    productId: z.string().uuid(),
    unit: z.string(),
    quantity: z.string(),
  })).optional(),
  replenishments: z.array(z.object({
    shipmentId: z.string().uuid(),
    unit: z.string(),
    quantity: z.string(),
    routeRequest: z.object({
      originId: z.string().uuid(),
      destinationId: z.string().uuid(),
    }).optional(),
  })).optional(),
})