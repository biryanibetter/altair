import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const cli = fileURLToPath(new URL('../src/cli.ts', import.meta.url))

function runCli(job: string) {
  return spawnSync(process.execPath, ['--import', 'tsx', cli, job], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: { ...process.env, DATABASE_URL: '' },
    encoding: 'utf8',
    timeout: 15_000,
  })
}

describe('standalone ingestion CLI', () => {
  it('loads shared contracts and rejects an unknown job before connecting', () => {
    const result = runCli('__audit_invalid_job__')
    expect(result.error).toBeUndefined()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Usage: pnpm --filter @altair/backend ingest <')
    expect(result.stderr).not.toContain('SyntaxError')
  }, 20_000)

  it('loads configuration and reports missing database credentials without printing them', () => {
    const result = runCli('weather')
    expect(result.error).toBeUndefined()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('ingestion_unavailable')
    expect(result.stderr).not.toContain('SyntaxError')
    expect(result.stderr).not.toContain('postgresql://')
  }, 20_000)
})
