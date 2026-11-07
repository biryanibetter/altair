import { AuthenticatedApp } from '@/components/workspace/auth'
import { getSupabaseConfig } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export default function Page() {
  let config: { url: string; key: string }
  try { config = getSupabaseConfig() } catch { return <main className="auth-wrap"><section className="auth-panel"><div className="brand">△ ALTAIR</div><p className="eyebrow">Secure workspace access · B2B shipping</p><h1>Workspace setup required</h1><p>The administrator must configure the Supabase project URL and publishable key before signing in.</p></section></main> }
  return <AuthenticatedApp url={config.url} publishableKey={config.key} />
}
