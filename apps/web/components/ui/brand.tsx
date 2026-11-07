'use client'
import { forwardRef } from 'react'

export interface BrandProps {
  size?: number
  className?: string
  'aria-label'?: string
}

export const Brand = forwardRef<SVGSVGElement, BrandProps>(
  ({ size = 30, className = '', 'aria-label': ariaLabel = 'ALTAIR', ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label={ariaLabel}
      role="img"
      {...props}
    >
      <rect width="120" height="120" rx="8" fill="#1a1a1a" />
      <text x="60" y="70" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="600" font-size="24" fill="#e9e9e9" letter-spacing="0.16em">ALTAIR</text>
      <polygon points="60,30 70,50 90,50 75,65 80,85 60,72 40,85 45,65 30,50 50,50" fill="#e9e9e9" />
    </svg>
  )
)

Brand.displayName = 'Brand'