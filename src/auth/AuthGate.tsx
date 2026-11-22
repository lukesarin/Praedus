import type { SupabaseClient, User } from '@supabase/supabase-js'
import { useCallback, useEffect, useRef, useState } from 'react'
import App from '../app/App'
import { claimLegacyData, openUserDatabase } from '../db/db'
import { friendlyAuthError } from './authErrors'
import { Intro } from './Intro'
import { shouldPlayIntro } from './introRule'
import { supabase as defaultClient } from './supabase'
import { SetupNeeded, WelcomeScreen, type WelcomeMode } from './WelcomeScreen'

type Phase = 'loading' | 'welcome' | 'intro' | 'app'

/**
 * The front door. Signed out: the welcome screens. Signed in: the account's own database, then
 * the intro (once per account) and the app. Nothing inside the app knows accounts exist.
 */
export function AuthGate({ client = defaultClient }: { client?: SupabaseClient | null }) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [mode, setMode] = useState<WelcomeMode>('login')
  const [user, setUser] = useState<User | null>(null)
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const appRef = useRef<HTMLDivElement>(null)
  const enteredAs = useRef<string | null>(null)

  const enter = useCallback(async (u: User) => {
    if (enteredAs.current === u.id) return
    enteredAs.current = u.id
    const database = openUserDatabase(u.id)
    await claimLegacyData(database, u.id).catch(() => 'none')
    setUser(u)
    if (shouldPlayIntro(u)) {
      // Marked before playing, so a reload mid-intro never replays it.
      void client?.auth.updateUser({ data: { praedus_intro_seen: true } })
      setPhase('intro')
    } else {
      setPhase('app')
    }
  }, [client])

  useEffect(() => {
    if (!client) return
    const { data } = client.auth.onAuthStateChange((event, session) => {
      // Supabase advises against awaiting its own calls inside this callback, so defer the work.
      setTimeout(() => {
        if (event === 'PASSWORD_RECOVERY') {
          setMode('new-password')
          setPhase('welcome')
          return
        }
        if (session?.user) void enter(session.user)
        else {
          enteredAs.current = null
          setUser(null)
          setPhase('welcome')
        }
      }, 0)
    })
    return () => data.subscription.unsubscribe()
  }, [client, enter])

  const introDone = useCallback(() => setPhase('app'), [])

  if (!client) return <SetupNeeded />
  if (phase === 'loading') return <div className="loading" />

  async function attempt(task: () => Promise<{ error: unknown }>, after?: () => void) {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const { error: err } = await task()
      if (err) setError(friendlyAuthError(err))
      else after?.()
    } catch (err) {
      setError(friendlyAuthError(err))
    } finally {
      setBusy(false)
    }
  }

  const origin = window.location.origin
  const auth = client.auth

  if (phase === 'welcome' || !user) {
    return (
      <WelcomeScreen
        mode={mode}
        email={email}
        error={error}
        notice={notice}
        busy={busy}
        onMode={(m) => { setMode(m); setError(null); setNotice(null) }}
        onGoogle={() => void attempt(() => auth.signInWithOAuth({ provider: 'google', options: { redirectTo: origin } }))}
        onLogin={(e, pw) => void attempt(() => auth.signInWithPassword({ email: e, password: pw }))}
        onSignup={(e, pw) => {
          setEmail(e)
          void attempt(async () => {
            const res = await auth.signUp({ email: e, password: pw, options: { emailRedirectTo: origin } })
            // With email confirmation on (the default), there's no session until the link is opened.
            if (!res.error && !res.data.session) setMode('check-email')
            return res
          })
        }}
        onResend={() => void attempt(
          () => auth.resend({ type: 'signup', email, options: { emailRedirectTo: origin } }),
          () => setNotice('Sent. Check your inbox (and spam folder).'),
        )}
        onForgot={(e) => void attempt(
          () => auth.resetPasswordForEmail(e, { redirectTo: origin }),
          () => setNotice("If there's an account for that email, a reset link is on its way."),
        )}
        onNewPassword={(pw) => void attempt(
          () => auth.updateUser({ password: pw }),
          () => {
            setMode('login')
            void auth.getUser().then(({ data }) => data.user && enter(data.user))
          },
        )}
      />
    )
  }

  const account = { email: user.email ?? '', onLogOut: () => void auth.signOut({ scope: 'local' }) }
  return (
    <>
      <div ref={appRef} className="app-root">
        <App account={account} />
      </div>
      {phase === 'intro' && <Intro appRef={appRef} onDone={introDone} />}
    </>
  )
}
