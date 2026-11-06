import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@altair/ui', '@altair/shared', '@altair/engine'],
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
}

export default nextConfig