import { config } from 'dotenv'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { randomBytes } from 'node:crypto'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
config({ path: resolve(root, 'apps/web/.env.local'), quiet: true })
config({ path: resolve(root, '.env.local'), quiet: true, override: false })

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SECRET_KEY
if (!url || !key) { console.log(JSON.stringify({ ok: false, reason: 'missing SUPABASE_URL or SUPABASE_SECRET_KEY' })); process.exit(0) }

const email = process.argv[2] ?? 'altair.e2e@example.com'
const password = process.env.E2E_PASSWORD ?? `Altair-${randomBytes(9).toString('base64url')}!7`

const response = await fetch(`${url.replace(/\/$/, '')}/auth/v1/admin/users`, {
  method: 'POST',
  headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' },
  body: JSON.stringify({ email, password, email_confirm: true }),
})
const body = await response.json().catch(() => ({}))
console.log(JSON.stringify({
  ok: response.ok,
  status: response.status,
  userId: body.id ?? null,
  email: body.email ?? email,
  confirmed: body.email_confirmed_at ? true : false,
  error: response.ok ? null : (body.msg ?? body.message ?? body.error_description ?? 'unknown'),
  password: response.ok ? password : null,
}, null, 2))
