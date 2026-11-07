import { config } from 'dotenv'
import postgres from 'postgres'

import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
config({ path: resolve(root, '.env.local'), quiet: true })
config({ path: resolve(root, 'apps/web/.env.local'), quiet: true, override: false })

const url = process.env.DATABASE_URL
if (!url) { console.log(JSON.stringify({ ok: false, reason: 'missing DATABASE_URL' })); process.exit(0) }
let parsed
try { parsed = new URL(url) } catch { console.log(JSON.stringify({ ok: false, reason: 'invalid URL' })); process.exit(0) }
const info = {
  protocol: parsed.protocol,
  host: parsed.hostname.replace(/^[^.]+/, '***'),
  port: parsed.port || '5432',
  user: parsed.username.replace(/^postgres\.[^.]+$/, 'postgres.***'),
  passwordPlaceholder: !parsed.password || decodeURIComponent(parsed.password) === 'YOUR-DATABASE-PASSWORD',
  hasSupabaseUrl: Boolean(process.env.SUPABASE_URL),
  hasPublishable: Boolean(process.env.SUPABASE_PUBLISHABLE_KEY),
  hasSecret: Boolean(process.env.SUPABASE_SECRET_KEY),
}

let result
const sql = postgres(url, { prepare: false, max: 1, connect_timeout: 8, connection: { statement_timeout: 5000 } })
try {
  const rows = await sql`select current_database() as db, current_user as role, version() as version`
  result = { connected: true, database: rows[0].db, role: rows[0].role, version: String(rows[0].version).slice(0, 40) }
} catch (error) {
  result = { connected: false, code: error.code ?? null, message: String(error.message).slice(0, 160) }
} finally { await sql.end({ timeout: 5 }).catch(() => {}) }

console.log(JSON.stringify({ ...info, ...result }, null, 2))
