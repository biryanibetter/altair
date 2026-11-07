import { NextResponse } from 'next/server'
import { z } from 'zod'
import { demoRequest, initialState } from '@/lib/demo/transport'

export const runtime = 'nodejs'
const requestSchema = z.object({ path: z.string().max(300), method: z.enum(['GET', 'POST', 'PUT', 'PATCH']).default('GET'), body: z.unknown().optional(), state: z.unknown().optional() }).strict()
export async function POST(request: Request) {
  try {
    if (Number(request.headers.get('content-length') ?? 0) > 2_000_000) return NextResponse.json({ error: 'demo_state_too_large' }, { status: 413 })
    const text = await request.text()
    if (text.length > 2_000_000) return NextResponse.json({ error: 'demo_state_too_large' }, { status: 413 })
    const input = requestSchema.parse(JSON.parse(text))
    const result = await demoRequest(input.path, input.body, input.state ?? initialState(), input.method)
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return NextResponse.json({ error: error instanceof z.ZodError ? 'Invalid demo input.' : error instanceof Error ? error.message : 'Demo action unavailable.' }, { status: 400 })
  }
}
