type AuthFailure = { message?: string; code?: string; status?: number }

/** Turns Supabase Auth errors (and network failures) into plain guidance for students. */
export function friendlyAuthError(err: unknown): string {
  const e: AuthFailure = err && typeof err === 'object' ? (err as AuthFailure) : {}
  const msg = e.message ?? ''
  const is = (code: string, text?: RegExp) => e.code === code || (text ? text.test(msg) : false)

  if (err instanceof TypeError || /Failed to fetch|NetworkError|Load failed/i.test(msg)) {
    return "Couldn't reach Praedus. Check your connection and try again."
  }
  if (is('invalid_credentials', /Invalid login credentials/i)) return "That email and password don't match."
  if (is('user_already_exists', /already registered|already exists/i)) {
    return 'An account with that email already exists. Log in instead.'
  }
  if (is('email_not_confirmed', /Email not confirmed/i)) return 'Confirm your email first; we sent you a link.'
  if (is('weak_password', /Password should be/i)) return 'Use a password with at least 8 characters.'
  if (is('over_email_send_rate_limit') || e.status === 429) {
    return 'Too many emails were sent just now. Try again in a little while.'
  }
  return 'Something went wrong. Try again.'
}
