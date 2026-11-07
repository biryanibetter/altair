// ALTAIR Auth - Supabase Authentication with Demo Mode Support
import 'server-only'
import type { SupabaseClient, User, UserIdentity } from '@supabase/supabase-js'
import { createSupabaseServerClient } from './server'
import { isDemoMode } from '@/lib/demo/config'

// Demo user for demo mode
const DEMO_USER = {
  id: '00000000-0000-4000-8000-000000000001',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'demo@altair.example',
  email_confirmed_at: new Date().toISOString(),
  phone: '',
  confirmation_sent_at: new Date().toISOString(),
  confirmed_at: new Date().toISOString(),
  last_sign_in_at: new Date().toISOString(),
  app_metadata: { provider: 'demo', providers: ['demo'] },
  user_metadata: { name: 'ALTAIR Demo User' },
  identities: [{
    id: '00000000-0000-4000-8000-000000000001',
    user_id: '00000000-0000-4000-8000-000000000001',
    identity_data: { email: 'demo@altair.example' },
    provider: 'demo',
    last_sign_in_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    identity_id: '00000000-0000-4000-8000-000000000001',
  }] as UserIdentity[],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  factors: [],
} as User

// Always verify with Supabase Auth; never authorize from a decoded cookie or getSession().
// In demo mode, return a deterministic demo user.
export async function getAuthenticatedUser(client?: Pick<SupabaseClient, 'auth'>): Promise<User | null> {
  // Check demo mode first (server-side)
  if (isDemoMode()) {
    return DEMO_USER
  }
  
  const supabase = client ?? await createSupabaseServerClient()
  const { data, error } = await supabase.auth.getUser()
  return error ? null : data.user
}

// Check if current request is in demo mode
export function isDemoRequest(): boolean {
  return isDemoMode()
}