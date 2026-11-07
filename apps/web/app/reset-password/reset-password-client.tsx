'use client'
import { useEffect, useState } from 'react'
import { browserClient } from '@/lib/supabase/browser'
import { Brand } from '@/components/ui/brand'
import { Button } from '@/components/ui/button'
import { ErrorMessage } from '@/components/workspace/common'

interface ResetPasswordClientProps {
  url: string
  publishableKey: string
}

export default function ResetPasswordClient({ url, publishableKey }: ResetPasswordClientProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [notice, setNotice] = useState('')
  const [ready, setReady] = useState(false)
  const [hasSession, setHasSession] = useState(false)

  useEffect(() => {
    let active = true
    const client = browserClient(url, publishableKey)

    const checkSession = async () => {
      const { data: { session } } = await client.auth.getSession()
      if (active) {
        setHasSession(!!session)
        setReady(true)
      }
    }
    checkSession()

    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      if (active) setHasSession(!!session)
    })
    return () => { active = false; subscription.unsubscribe() }
  }, [url, publishableKey])

  if (!ready) return <div className="auth-wrap"><div className="skeleton">Loading…</div></div>

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return
    const form = new FormData(event.currentTarget)
    const password = String(form.get('password'))
    if (password.length < 8) { setError(new Error('Password must be at least 8 characters')); return }

    setBusy(true)
    setError(null)
    setNotice('')

    try {
      const client = browserClient(url, publishableKey)
      const { error: updateError } = await client.auth.updateUser({ password })
      if (updateError) throw updateError
      setNotice('Password updated. Redirecting to sign in…')
      setTimeout(() => window.location.href = '/', 1500)
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  if (!hasSession) {
    return (
      <main className="auth-wrap">
        <section className="auth-panel">
          <Brand size={48} className="mx-auto" aria-label="ALTAIR" />
          <h1>Reset password</h1>
          <p style={{ color: 'var(--text-dim)', fontSize: '12px' }}>Your password reset link has expired or is invalid. Please request a new one.</p>
          <Button variant="ghost" onClick={() => window.location.href = '/'}>Request new link</Button>
        </section>
      </main>
    )
  }

  return (
    <main className="auth-wrap">
      <section className="auth-panel">
        <Brand size={48} className="mx-auto" aria-label="ALTAIR" />
        <h1>Set new password</h1>
        <form onSubmit={handleSubmit}>
          <label>New password<input autoComplete="new-password" type="password" name="password" minLength={8} required /></label>
          <ErrorMessage error={error} />
          {notice ? <p role="status">{notice}</p> : null}
          <Button disabled={busy} type="submit">{busy ? 'Please wait…' : 'Update password'}</Button>
        </form>
        <Button variant="ghost" onClick={() => window.location.href = '/'}>Back to sign in</Button>
      </section>
    </main>
  )
}