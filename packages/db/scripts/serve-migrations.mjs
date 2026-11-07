import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, basename } from 'node:path'

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'drizzle')
const server = createServer((request, response) => {
  const name = basename(decodeURIComponent((request.url ?? '/').slice(1)))
  if (!/^\d+_[a-z0-9_]+\.sql$/.test(name)) { response.writeHead(404).end(); return }
  try {
    const body = readFileSync(join(dir, name))
    response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' })
    response.end(body)
  } catch { response.writeHead(404).end() }
})
server.listen(3999, '127.0.0.1', () => console.log('serving migrations on 3999'))
