import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'
      if (isLocalEnv) {
        redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        redirect(`https://${forwardedHost}${next}`)
      } else {
        redirect(`${origin}${next}`)
      }
    }
  }

  // If code is missing or exchange failed, redirect to sign in with error
  redirect(`${origin}/?error=auth_callback_failed`)
}