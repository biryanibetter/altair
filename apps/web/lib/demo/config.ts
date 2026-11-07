// ALTAIR Demo Mode Configuration
// This file controls demo mode behavior and feature flags

export interface DemoConfig {
  enabled: boolean
  // Demo mode uses deterministic data and simulated responses
  // No external APIs, no real authentication, no database writes
  persistent: boolean // Persist demo state across refreshes in localStorage
  resetOnLoad: boolean // Reset to initial state on page load (for consistent demos)
  showDemoIndicator: boolean // Show "DEMO MODE" badges
  simulateDelays: boolean // Simulate network delays for realism
  // Feature flags for specific demo capabilities
  features: {
    shipments: boolean
    routePlanning: boolean
    inventory: boolean
    suppliers: boolean
    alerts: boolean
    crisis: boolean
    assistant: boolean
    map: boolean
  }
}

// Default demo configuration
// Can be overridden by environment variables or localStorage
export const defaultDemoConfig: DemoConfig = {
  enabled: process.env.NEXT_PUBLIC_DEMO_MODE === 'true',
  persistent: true,
  resetOnLoad: false,
  showDemoIndicator: true,
  simulateDelays: false,
  features: {
    shipments: true,
    routePlanning: true,
    inventory: true,
    suppliers: true,
    alerts: true,
    crisis: true,
    assistant: true,
    map: true,
  },
}

// Demo mode storage key
export const DEMO_STORAGE_KEY = 'altair-demo-state'

// Check if demo mode is enabled (client-side)
export function isDemoMode(): boolean {
  if (typeof window !== 'undefined') {
    // Client-side: check localStorage first, then env
    const stored = localStorage.getItem('altair-demo-enabled')
    if (stored !== null) return stored === 'true'
  }
  return defaultDemoConfig.enabled
}

// Check if demo mode is enabled from request headers (server-side)
export function isDemoModeFromHeaders(headers: Headers): boolean {
  const cookie = headers.get('cookie') || ''
  return cookie.includes('altair-demo-enabled=true')
}

// Enable/disable demo mode
export function setDemoMode(enabled: boolean): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('altair-demo-enabled', String(enabled))
    // Reload to apply changes
    window.location.reload()
  }
}

// Get demo configuration (merged with stored preferences)
export function getDemoConfig(): DemoConfig {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('altair-demo-config')
    if (stored) {
      try {
        return { ...defaultDemoConfig, ...JSON.parse(stored) }
      } catch {
        return defaultDemoConfig
      }
    }
  }
  return defaultDemoConfig
}

// Update demo configuration
export function updateDemoConfig(partial: Partial<DemoConfig>): void {
  if (typeof window !== 'undefined') {
    const current = getDemoConfig()
    const updated = { ...current, ...partial }
    localStorage.setItem('altair-demo-config', JSON.stringify(updated))
  }
}