import { z } from 'zod'
import { shippingEventInputSchema } from '@altair/shared/contracts'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/lib/supabase/auth'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
type Context = { params: Promise<{ id: string }> }
async function handle(request: Request, context: Context, write: boolean) {
  try {
    const client = await createSupabaseServerClient(), user = await getAuthenticatedUser(client)
    if (!user) return json({ error: 'unauthorized' }, 401)
    const { id } = await context.params
    if (!z.uuid().safeParse(id).success) return json({ error: 'invalid_id' }, 400)
    if (write) {
      const origin = request.headers.get('origin')
      if (origin && origin !== new URL(request.url).origin) return json({ error: 'invalid_origin' }, 403)
      const raw = await request.text()
      if (raw.length > 262144) return json({ error: 'body_too_large' }, 413)
      const parsed = shippingEventInputSchema.safeParse(JSON.parse(raw))
      if (!parsed.success) return json({ error: 'invalid_event' }, 400)
      const { data, error } = await client.rpc('shipping_event', { target: id, input: parsed.data })
      if (error) return json({ error: error.code === '40001' ? 'shipment_conflict' : 'shipping_write_failed' }, error.code === '40001' ? 409 : ['22023','23514','23503','22P02'].includes(error.code ?? '') ? 400 : 503)
      return data ? json(data, 201) : json({ error: 'not_found' }, 404)
    }
    const cursor = new URL(request.url).searchParams.get('cursor')
    if (cursor && !z.uuid().safeParse(cursor).success) return json({ error: 'invalid_cursor' }, 400)
    const { data: shipment, error: ownerError } = await client.from('shipments').select('id').eq('id', id).eq('owner_id', user.id).maybeSingle()
    if (ownerError) return json({ error: 'storage_unavailable' }, 503)
    if (!shipment) return json({ error: 'not_found' }, 404)
    let query = client.from('shipment_events').select('id,shipment_id,kind,title,note,source,occurred_at,created_at,payload,request_id,decision').eq('shipment_id', id).eq('owner_id', user.id).order('id').limit(101)
    if (cursor) query = query.gt('id', cursor)
    const { data, error } = await query
    if (error) return json({ error: 'storage_unavailable' }, 503)
    const rows = data ?? []
    return json({ data: rows.slice(0, 100), nextCursor: rows.length > 100 ? rows[99].id : null })
  } catch (error) { return json({ error: 'shipping_unavailable' }, error instanceof SyntaxError ? 400 : 503) }
}
export const GET = (request: Request, context: Context) => handle(request, context, false)
export const POST = (request: Request, context: Context) => handle(request, context, true)
