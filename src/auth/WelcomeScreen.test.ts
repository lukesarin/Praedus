import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SetupNeeded, WelcomeScreen, type WelcomeMode } from './WelcomeScreen'

const noop = () => {}
const render = (mode: WelcomeMode, extra: Record<string, unknown> = {}) =>
  renderToStaticMarkup(createElement(WelcomeScreen, {
    mode, onMode: noop, onGoogle: noop, onLogin: noop, onSignup: noop, onForgot: noop, onResend: noop, onNewPassword: noop, ...extra,
  }))

describe('WelcomeScreen', () => {
  it('shows the statement and the log in form', () => {
    const html = render('login')
    expect(html).toContain('Your semester,')
    expect(html).toContain('in rhythm.')
    expect(html).toContain('Welcome back')
    expect(html).toContain('Continue with Google')
    expect(html).toContain('Forgot password?')
    expect(html).toContain('Create an account')
  })

  it('shows sign up with the password rule', () => {
    const html = render('signup')
    expect(html).toContain('Create your account')
    expect(html).toContain('Use 8 or more characters.')
    expect(html).toContain('Log in')
  })

  it('tells new students to check their email, with a way to resend', () => {
    const html = render('check-email', { email: 'sam@school.edu' })
    expect(html).toContain('Check your email')
    expect(html).toContain('sam@school.edu')
    expect(html).toContain('Resend email')
  })

  it('offers a reset link and a new-password form', () => {
    expect(render('forgot')).toContain('Send reset link')
    expect(render('new-password')).toContain('Set a new password')
  })

  it('shows errors as an alert', () => {
    expect(render('login', { error: "That email and password don't match." }))
      .toMatch(/role="alert"[^>]*>That email and password don&#x27;t match\./)
  })
})

describe('SetupNeeded', () => {
  it('explains what to configure instead of breaking', () => {
    const html = renderToStaticMarkup(createElement(SetupNeeded))
    expect(html).toContain("Praedus isn&#x27;t connected to its account service yet.")
    expect(html).toContain('VITE_SUPABASE_URL')
    expect(html).toContain('VITE_SUPABASE_PUBLISHABLE_KEY')
  })
})
