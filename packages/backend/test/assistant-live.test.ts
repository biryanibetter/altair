import { config } from 'dotenv'
import { expect, it } from 'vitest'
import { assistantRequestSchema } from '@altair/shared/contracts'
import { OpenRouterProvider } from '../src/assistant/provider'
import { chat } from '../src/assistant/orchestrator'
config({ path: '../../.env.local', quiet: true })
// Explicit opt-in; synthetic fixtures only, never real customer data or paid fallback.
it.skipIf(process.env.ALTAIR_LIVE_LLM !== '1' || !process.env.OPENROUTER_API_KEY)('live OpenRouter free tool request → server validation → evidence → structured answer', async () => {
  const id = '10000000-0000-4000-8000-000000000001'
  const provider = new OpenRouterProvider(process.env)
  const output = await chat(assistantRequestSchema.parse({ message: 'Call inspect_inventory with limit 1. Report the returned quantity at /data/0/quantity with its evidenceId and recommend verify_records. These are synthetic test records, not real stock.' }), provider, async (name) => {
    if (name !== 'inspect_inventory') return Response.json({ error: 'not_found' }, { status: 404 })
    return Response.json({ version: 'supply-1.0.0', data: [{ id, productId: id, warehouseId: id, quantity: '42', reservedQuantity: '0', unit: 'kg', historyStart: null }], nextCursor: null })
  })
  // Do not log provider bodies/keys. Codes and safe assertions suffice for diagnosis.
  expect(output.errors.map(e => e.code)).toEqual([])
  expect(output.status).toBe('ok'); expect(output.evidence[0]?.tool).toBe('inspect_inventory')
  expect(output.findings.some(f => f.value === '42')).toBe(true)
}, 60000)
