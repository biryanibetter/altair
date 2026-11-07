import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
for (const rel of ['apps/web/.env.local', '.env.local']) {
  const path = resolve(root, rel)
  if (!existsSync(path)) continue
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^["']|["']$/g, '')
  }
}
const url = process.env.SUPABASE_URL.replace(/\/$/, '')
const key = process.env.SUPABASE_SECRET_KEY
for (const [label, path, headers] of [
  ['root-anon', '/rest/v1/', { apikey: process.env.SUPABASE_PUBLISHABLE_KEY }],
  ['root-secret', '/rest/v1/', { apikey: key, authorization: `Bearer ${key}` }],
  ['table-head-secret', '/rest/v1/data_sources?select=id', { apikey: key, authorization: `Bearer ${key}`, prefer: 'count=exact' }],
  ['auth-health', '/auth/v1/health', { apikey: process.env.SUPABASE_PUBLISHABLE_KEY }],
]) {
  try {
    const response = await fetch(url + path, { headers, cache: 'no-store' })
    console.log(label, response.status, response.headers.get('content-type'))
  } catch (error) { console.log(label, 'error', String(error.message).slice(0, 80)) }
}
