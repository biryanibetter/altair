import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
function load(rel) {
  const path = resolve(root, rel)
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!match) continue
    const value = match[2].replace(/^["']|["']$/g, '')
    if (process.env[match[1]] === undefined) process.env[match[1]] = value
  }
}
load('apps/web/.env.local')
load('.env.local')

console.error('loaded keys:', Object.keys(process.env).filter(k => k.startsWith('SUPABASE') || k === 'DATABASE_URL').join(','))
const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const out = {}
for (const table of ['data_sources', 'locations', 'products', 'warehouses', 'shipments', 'inventory', 'suppliers', 'alerts', 'provider_observations']) {
  const { count, error } = await client.from(table).select('*', { count: 'exact', head: true })
  out[table] = error ? { error: error.code ?? error.message } : { count }
}
const { data: authUsers, error: authError } = await client.auth.admin.listUsers({ page: 1, perPage: 5 })
out.auth = authError ? { error: authError.message } : { users: authUsers.users.map(u => ({ id: u.id, email: u.email, confirmed: Boolean(u.email_confirmed_at) })) }
console.log(JSON.stringify(out, null, 2))
