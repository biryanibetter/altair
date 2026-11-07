import { config } from 'dotenv'
import { defineConfig } from 'drizzle-kit'
import { getDatabaseUrl } from './src/env'

config({ path: '../../.env.local', quiet: true })

export default defineConfig({
  schema: './src/schema/*.ts',
  out: './drizzle',
  dialect: 'postgresql',
  schemaFilter: ['public'],
  // Generation is offline; migrations require a validated real password.
  dbCredentials: process.env.DATABASE_URL?.includes('YOUR-DATABASE-PASSWORD')
    ? undefined
    : { url: getDatabaseUrl() },
})
