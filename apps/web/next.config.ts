import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async redirects() {
    return Object.entries({ tracking: 'shipments', routes: 'routes', inventory: 'inventory', suppliers: 'suppliers', risk: 'alerts', crisis: 'crisis', resilience: 'crisis', compliance: 'crisis', copilot: 'overview' }).map(([source, page]) => ({ source: `/${source}`, destination: `/#${page}`, permanent: false }))
  },
}

export default nextConfig
