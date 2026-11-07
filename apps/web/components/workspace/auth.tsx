'use client'
import { useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { browserClient } from '@/lib/supabase/browser'
import { Button } from '@/components/ui/button'
import { ErrorMessage } from './common'
import { DataProvider } from './data'
import { Workspace } from './shell'

export function AuthenticatedApp({ url, publishableKey }: { url: string; publishableKey: string }) {
  const client = useMemo(() => browserClient(url, publishableKey), [url, publishableKey])
  const [user, setUser] = useState<User | null>(null), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState<unknown>(null), [signup, setSignup] = useState(false), [notice, setNotice] = useState('')
  useEffect(() => {
    let active = true
    void client.auth.getUser().then(({ data }) => { if (active) { setUser(data.user); setLoading(false) } }).catch(e => { if (active) { setError(e); setLoading(false) } })
    const { data } = client.auth.onAuthStateChange((_event, session) => { if (active) setUser(session?.user ?? null) })
    const expired = () => { setUser(null); setError(new Error('Your session expired. Please sign in again.')) }
    window.addEventListener('altair:unauthorized', expired)
    return () => { active = false; data.subscription.unsubscribe(); window.removeEventListener('altair:unauthorized', expired) }
  }, [client])
  if (loading) return <div className="auth-wrap"><div className="skeleton">Checking session…</div></div>
  if (user) return <DataProvider key={user.id}><Workspace email={user.email ?? 'Account'} signOut={async () => { const { error } = await client.auth.signOut(); if (error) throw error; setUser(null) }} /></DataProvider>
  return <main className="auth-wrap"><section className="auth-panel"><div className="brand">△ ALTAIR</div><p className="eyebrow">Secure workspace access · B2B shipping</p><h1>{signup ? 'Create your workspace account' : 'Welcome back'}</h1><p>Shipping operations. Grounded intelligence.</p><form onSubmit={async event => { event.preventDefault(); if (busy) return; const form = new FormData(event.currentTarget); setBusy(true); setError(null); setNotice(''); try { const credentials = { email: String(form.get('email')), password: String(form.get('password')) }; const result = signup ? await client.auth.signUp(credentials) : await client.auth.signInWithPassword(credentials); if (result.error) throw result.error; if (signup && !result.data.session) setNotice('Check your email to confirm your account, then sign in.'); else setUser(result.data.user) } catch (e) { setError(e) } finally { setBusy(false) } }}><label>Email<input autoComplete="email" type="email" name="email" required /></label><label>Password<input autoComplete={signup ? 'new-password' : 'current-password'} type="password" name="password" minLength={8} required /></label><ErrorMessage error={error} />{notice ? <p role="status">{notice}</p> : null}<Button disabled={busy} type="submit">{busy ? 'Please wait…' : signup ? 'Create account' : 'Sign in'}</Button></form><Button variant="ghost" onClick={() => { setSignup(!signup); setError(null) }}>{signup ? 'Already have an account? Sign in' : 'Create an account'}</Button></section></main>
}
