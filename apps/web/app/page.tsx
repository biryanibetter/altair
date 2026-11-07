import { AuthenticatedApp } from '@/components/workspace/auth'
import { getSupabaseConfig } from '@/lib/supabase/server'
import { DemoWorkspace } from '@/components/workspace/demo'
import Link from 'next/link'

export const dynamic = 'force-dynamic'
export default async function Page({ searchParams }: { searchParams: Promise<{ demo?: string }> }) {
  if ((await searchParams).demo === '1') return <DemoWorkspace />
  let config: { url: string; key: string }
  try { config = getSupabaseConfig() } catch { return <main className="auth-wrap"><section className="auth-panel"><div className="brand">△ ALTAIR</div><p className="eyebrow">B2B shipping · Supply chain intelligence</p><h1>Explore the workspace</h1><p>Production sign-in requires a configured Supabase project. Demo Mode works with fictional records and no account.</p><Link className="text-action" href="/?demo=1">Enter Demo Mode →</Link></section></main> }
  return <><AuthenticatedApp url={config.url} publishableKey={config.key} /><Link className="demo-entry" href="/?demo=1">Enter Demo Mode · Fictional records</Link></>
}
