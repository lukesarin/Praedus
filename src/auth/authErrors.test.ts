import { describe, expect, it } from 'vitest'
import { friendlyAuthError } from './authErrors'
import { shouldPlayIntro } from './introRule'

describe('friendlyAuthError', () => {
  it('explains a wrong email or password', () => {
    expect(friendlyAuthError({ code: 'invalid_credentials', message: 'Invalid login credentials' }))
      .toBe("That email and password don't match.")
    expect(friendlyAuthError({ message: 'Invalid login credentials' })).toBe("That email and password don't match.")
  })

  it('points existing accounts to log in', () => {
    expect(friendlyAuthError({ code: 'user_already_exists' })).toBe('An account with that email already exists. Log in instead.')
    expect(friendlyAuthError({ message: 'User already registered' })).toBe('An account with that email already exists. Log in instead.')
  })

  it('asks for email confirmation', () => {
    expect(friendlyAuthError({ code: 'email_not_confirmed' })).toBe('Confirm your email first; we sent you a link.')
  })

  it('explains weak passwords', () => {
    expect(friendlyAuthError({ code: 'weak_password' })).toBe('Use a password with at least 8 characters.')
    expect(friendlyAuthError({ message: 'Password should be at least 8 characters.' })).toBe('Use a password with at least 8 characters.')
  })

  it('explains email rate limits', () => {
    expect(friendlyAuthError({ code: 'over_email_send_rate_limit' })).toBe('Too many emails were sent just now. Try again in a little while.')
    expect(friendlyAuthError({ status: 429, message: 'x' })).toBe('Too many emails were sent just now. Try again in a little while.')
  })

  it('explains network failures', () => {
    expect(friendlyAuthError(new TypeError('Failed to fetch'))).toBe("Couldn't reach Praedus. Check your connection and try again.")
    expect(friendlyAuthError({ message: 'Failed to fetch' })).toBe("Couldn't reach Praedus. Check your connection and try again.")
  })

  it('falls back to a calm generic message', () => {
    expect(friendlyAuthError({ message: 'boom' })).toBe('Something went wrong. Try again.')
    expect(friendlyAuthError(null)).toBe('Something went wrong. Try again.')
  })
})

describe('shouldPlayIntro', () => {
  it('plays for an account that has not seen it', () => {
    expect(shouldPlayIntro({ user_metadata: {} })).toBe(true)
    expect(shouldPlayIntro({})).toBe(true)
  })

  it('never plays again once seen, or without a user', () => {
    expect(shouldPlayIntro({ user_metadata: { praedus_intro_seen: true } })).toBe(false)
    expect(shouldPlayIntro(null)).toBe(false)
  })
})
