import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', '../../packages/ui/**/*.{ts,tsx}'],
  theme: { extend: { colors: Object.fromEntries(['background','foreground','border','input','ring','primary','secondary','muted','accent','destructive','popover','card'].map(name => [name, { DEFAULT: `hsl(var(--${name}))`, foreground: `hsl(var(--${name}-foreground))` }])) } },
  plugins: [],
} satisfies Config
