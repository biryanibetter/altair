import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
for (const line of readFileSync(resolve(root, 'apps/web/.env.local'), 'utf8').split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^["']|["']$/g, '')
}
const url = process.env.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/data_sources?select=id'
for (const method of ['HEAD', 'GET']) {
  const response = await fetch(url, {
    method,
    headers: { apikey: process.env.SUPABASE_SECRET_KEY, authorization: `Bearer ${process.env.SUPABASE_SECRET_KEY}` },
    cache: 'no-store',
  })
  console.log(method, response.status, (await response.text().catch(() => '')).slice(0, 120))
}
