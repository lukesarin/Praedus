import { useState } from 'react'
import { LogoIcon } from '../app/icons'

export type WelcomeMode = 'login' | 'signup' | 'forgot' | 'check-email' | 'new-password'

type Props = {
  mode: WelcomeMode
  email?: string
  error?: string | null
  notice?: string | null
  busy?: boolean
  onMode: (mode: WelcomeMode) => void
  onGoogle: () => void
  onLogin: (email: string, password: string) => void
  onSignup: (email: string, password: string) => void
  onForgot: (email: string) => void
  onResend: () => void
  onNewPassword: (password: string) => void
}

/** Google's "G", used as Google's sign-in guidelines intend: on the Continue with Google button. */
const GoogleG = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
)

function Statement({ children }: { children: React.ReactNode }) {
  return (
    <div className="welcome">
      <svg className="welcome-giant" viewBox="0 0 48 48" aria-hidden="true">
        <path d="M6.5 24C6.5 13 19.5 13 19.5 24S32.5 35 32.5 24" fill="none" stroke="currentColor" strokeWidth="5.5" strokeLinecap="round" />
        <circle cx="40.5" cy="24" r="3.9" fill="currentColor" />
      </svg>
      <div className="welcome-statement">
        <span className="welcome-brand"><LogoIcon size={26} />praedus</span>
        <h1>Your semester,<br />in rhythm.</h1>
        <p>Praedus brings in your Canvas deadlines, works around your classes and shifts, and plans a little study time each day.</p>
      </div>
      <div className="welcome-card">{children}</div>
    </div>
  )
}

/** The front door: log in, sign up, password reset and email confirmation, in the Statement layout. */
export function WelcomeScreen(props: Props) {
  const { mode, error, notice, busy, onMode } = props
  const [email, setEmail] = useState(props.email ?? '')
  const [password, setPassword] = useState('')
  const alert = error ? <p className="welcome-alert" role="alert">{error}</p> : null
  const info = notice ? <p className="welcome-notice" role="status">{notice}</p> : null
  const emailField = (
    <label className="welcome-field">
      <span>Email</span>
      <input type="email" required autoComplete="email" placeholder="you@school.edu" value={email}
        onChange={(e) => setEmail(e.target.value)} autoFocus />
    </label>
  )

  if (mode === 'check-email') {
    return (
      <Statement>
        <h2>Check your email</h2>
        <p className="welcome-sub">We sent a confirmation link to <strong>{props.email}</strong>. Open it on this device to finish creating your account.</p>
        {alert}{info}
        <button type="button" className="welcome-secondary" onClick={props.onResend} disabled={busy}>Resend email</button>
        <p className="welcome-switch"><button type="button" onClick={() => onMode('login')}>Back to log in</button></p>
      </Statement>
    )
  }

  if (mode === 'forgot') {
    return (
      <Statement>
        <form onSubmit={(e) => { e.preventDefault(); props.onForgot(email) }}>
          <h2>Reset your password</h2>
          <p className="welcome-sub">Enter your email and we'll send you a link to set a new password.</p>
          {emailField}
          {alert}{info}
          <button className="welcome-primary" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button>
          <p className="welcome-switch"><button type="button" onClick={() => onMode('login')}>Back to log in</button></p>
        </form>
      </Statement>
    )
  }

  if (mode === 'new-password') {
    return (
      <Statement>
        <form onSubmit={(e) => { e.preventDefault(); props.onNewPassword(password) }}>
          <h2>Set a new password</h2>
          <p className="welcome-sub">Choose a new password for your account.</p>
          <label className="welcome-field">
            <span>New password</span>
            <input type="password" required minLength={8} autoComplete="new-password" placeholder="At least 8 characters"
              value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
          </label>
          {alert}
          <button className="welcome-primary" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button>
        </form>
      </Statement>
    )
  }

  const login = mode === 'login'
  return (
    <Statement>
      <form onSubmit={(e) => { e.preventDefault(); (login ? props.onLogin : props.onSignup)(email, password) }}>
        <h2>{login ? 'Welcome back' : 'Create your account'}</h2>
        <p className="welcome-sub">{login ? 'Log in to pick up where you left off.' : 'Your calendar, deadlines and study plan, on every device.'}</p>
        <button type="button" className="welcome-google" onClick={props.onGoogle} disabled={busy}><GoogleG />Continue with Google</button>
        <div className="welcome-or">or</div>
        {emailField}
        <label className="welcome-field">
          <span>
            Password
            {login && <button type="button" className="welcome-link" onClick={() => onMode('forgot')}>Forgot password?</button>}
          </span>
          <input type="password" required minLength={login ? undefined : 8} autoComplete={login ? 'current-password' : 'new-password'}
            placeholder={login ? 'Your password' : 'At least 8 characters'} value={password} onChange={(e) => setPassword(e.target.value)} />
          {!login && <small>Use 8 or more characters.</small>}
        </label>
        {alert}{info}
        <button className="welcome-primary" disabled={busy}>
          {busy ? (login ? 'Logging in…' : 'Creating account…') : login ? 'Log in' : 'Create account'}
        </button>
        <p className="welcome-switch">
          {login ? 'New to Praedus? ' : 'Already have an account? '}
          <button type="button" onClick={() => onMode(login ? 'signup' : 'login')}>{login ? 'Create an account' : 'Log in'}</button>
        </p>
      </form>
    </Statement>
  )
}

/** Shown when the app has no account service settings, instead of a broken screen. */
export function SetupNeeded() {
  return (
    <Statement>
      <h2>Almost there</h2>
      <p className="welcome-sub">Praedus isn't connected to its account service yet.</p>
      <p className="welcome-sub">
        Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> to <code>.env.local</code>,
        then restart the app. The README's "Set up accounts" section walks through it.
      </p>
    </Statement>
  )
}
