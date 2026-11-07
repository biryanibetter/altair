import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
for (const rel of ['.env.local', 'apps/web/.env.local']) {
  const path = resolve(root, rel)
  if (!existsSync(path)) { console.log(rel, 'missing'); continue }
  const text = readFileSync(path, 'utf8')
  const line = text.split(/\r?\n/).find(l => /^\s*DATABASE_URL\s*=/.test(l))
  if (!line) { console.log(rel, 'no DATABASE_URL'); continue }
  const raw = line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')
  let parsed
  try { parsed = new URL(raw) } catch { console.log(rel, 'invalid URL'); continue }
  const placeholder = !parsed.password || decodeURIComponent(parsed.password) === 'YOUR-DATABASE-PASSWORD'
  console.log(rel, JSON.stringify({
    host: parsed.hostname.replace(/^[^.]+/, '***'),
    hostEndsWithKnownRef: parsed.hostname.includes('idegsvsqzojrpinjgilt'),
    userHasProjectRef: /^postgres\.[a-z]{20}$/.test(parsed.username),
    placeholder,
    passwordLength: parsed.password ? decodeURIComponent(parsed.password).length : 0,
  }))
}
