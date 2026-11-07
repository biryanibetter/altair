import type { SupabaseClient, User } from '@supabase/supabase-js'
import { createSupabaseServerClient } from './server'

// Always verify with Supabase Auth; never authorize from a decoded cookie or getSession().
export async function getAuthenticatedUser(client?: Pick<SupabaseClient, 'auth'>): Promise<User | null> {
  const supabase = client ?? await createSupabaseServerClient()
  const { data, error } = await supabase.auth.getUser()
  return error ? null : data.user
}
