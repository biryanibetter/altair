import { getSupabaseConfig } from '@/lib/supabase/server'
import ResetPasswordClient from './reset-password-client'

export default function ResetPasswordPage() {
  const config = getSupabaseConfig()
  return <ResetPasswordClient url={config.url} publishableKey={config.key} />
}