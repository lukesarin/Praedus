# Accounts, welcome screen and intro: design (project 1 of 3)

Status: awaiting approval · Date: 2026-11-21

## Intent

Praedus gets real accounts. Students sign up or log in (email and password, or Google) on a
welcome screen, see a short logo intro once after signing up, and land in the app. This is
project 1 of 3:

1. **Accounts** (this design)
2. **Cloud save:** everything saved to the account and restored on any device
3. **Going live:** hosting, custom email (SMTP), production setup

Until project 2, data still lives in the browser, but each account now gets its own space, so
students sharing a computer never see each other's data.

## Decisions (made with the user)

- Accounts through **Supabase Auth**. Login is **required**; there is no guest mode.
- Sign-in methods: **email + password** and **Continue with Google**. Apple can be added later.
- Welcome design: **C, Statement** from `design-exploration/welcome.html`: the headline "Your
  semester, in rhythm.", a short line, a faint oversized S mark, and the form in a card.
- Intro: **"The dot opens the app."** The S draws itself, there's a pause, the dot lands with a
  beat, and the dot expands as a circle that reveals the app. It plays **once per account**,
  after the first successful sign-in.

## Facts verified in Supabase's docs (2026-11-21)

- Browser apps use the **publishable key** (`sb_publishable_…`): "Safe to expose online". The
  legacy `anon` key is being deprecated by the end of 2026. Secret keys never go in the app.
- **Email confirmation is on by default** for hosted projects.
- Calls: `signUp`, `signInWithPassword`, `signInWithOAuth({ provider: 'google', options: { redirectTo } })`,
  `resetPasswordForEmail(email, { redirectTo })`, `updateUser({ password })` after the reset link,
  and `signOut()`. The default sign-out is **global** (every device), so Praedus uses
  `{ scope: 'local' }` for "Log out on this device".
- `onAuthStateChange` reports `INITIAL_SESSION`, `SIGNED_IN`, `SIGNED_OUT`, `PASSWORD_RECOVERY`,
  `TOKEN_REFRESHED` and `USER_UPDATED`.
- **The built-in email sends only to the project's team members, 2 emails/hour.** That's fine for
  development with the user's own email. Real students need custom SMTP (project 3).
- Redirect URLs need an allow-list entry (e.g. `http://localhost:5173/**`).
- Not verified: whether `user_metadata` can be edited by the user. So it only holds harmless
  flags (the intro flag), never anything that grants access.

## Goals

1. Opening Praedus while signed out shows the welcome screen (log in). Signed-in students go
   straight to the app, and stay signed in across reloads.
2. Screens, all in the Statement style:
   - **Log in:** Google, email, password, "Forgot password?", "New to Praedus? Create an account"
   - **Sign up:** Google, email, password (8+ characters), "Create account", "Already have an account? Log in"
   - **Check your email:** after sign-up, with the address and a "Resend email" button
   - **Forgot password:** email, "Send reset link", then "Check your email"
   - **Set a new password:** shown when the reset link opens the app (`PASSWORD_RECOVERY`)
3. Plain-language errors, e.g. "That email and password don't match.", "An account with that
   email already exists. Log in instead.", "Confirm your email first; we sent you a link."
4. The intro plays once per account after the first sign-in. It can be skipped with a click or any
   key, and becomes a simple fade for anyone whose device is set to reduce motion. The flag
   `praedus_intro_seen: true` lives in the user's metadata, so it doesn't replay on a new device.
5. **Separate data per account.** The app opens a local database named for the account
   (`praedus-<userId>`). The first account to sign in on a browser that has existing
   pre-accounts data (`studyblocks`) gets it copied in, so nothing is lost. The old database is
   then marked as claimed and never offered to another account.
6. An account row at the bottom of the sidebar shows the email and **Log out** (this device only).
   Logging out returns to the welcome screen.
7. If Supabase isn't configured (no settings), the app shows a clear setup message instead of
   breaking.

## Non-goals

Cloud saving of data (project 2), Apple sign-in, account deletion UI (project 2, once data lives
on the server), custom email templates/SMTP and hosting (project 3), and changes to any existing
feature.

## Anti-goals

- A student sees another student's data on a shared computer.
- Existing local data is lost when accounts arrive.
- Secrets in the repository. `.env.local` is already ignored by Git (`*.local`).
- The intro replaying on every login, or being impossible to skip.

## Approach

Considered:

1. **An auth gate around the existing app (chosen).** A new `AuthGate` decides what to show:
   loading, welcome screens, intro or the app. `App` itself barely changes. The database becomes
   per-account by opening it with the account's name before `App` renders.
2. **Add a router and pages.** More structure than this needs. Only the gate decides between
   welcome and app. Rejected.
3. **Rewrite data access to pass a database everywhere.** Touches every module. Rejected; the
   live-binding approach below keeps imports unchanged.

## Design

### New folder `src/auth/`

- `supabase.ts`: creates the client from `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`,
  or reports "not configured".
- `authErrors.ts`: `friendlyAuthError(error)` maps Supabase errors to the plain messages above.
- `intro.ts`: `shouldPlayIntro(user)`, which is true when the account has no `praedus_intro_seen`.
- `AuthGate.tsx`: listens to `onAuthStateChange`, opens that account's database, and renders the
  welcome screens, the intro or `<App />`. It also handles `PASSWORD_RECOVERY`.
- `WelcomeScreen.tsx`: the Statement layout with the log in / sign up / forgot / check-email / new
  password states. On narrow screens it becomes one column (headline above the card).
- `Intro.tsx`: the draw, pause, dot and circle-reveal sequence, using the Web Animations API on
  an SVG of the mark, as in the preview.

### Changed files (small)

- `src/db/db.ts`: `db` becomes a live binding set by `openUserDatabase(userId)` (it stays
  importable everywhere unchanged), plus `claimLegacyData(from, to)`, which copies every table
  once.
- `src/main.tsx`: renders `<AuthGate />` in place of `<App />`.
- `src/app/Sidebar.tsx` and `theme.css`: the account row with email and Log out. Styles for the
  welcome screens and intro.
- `package.json`: adds `@supabase/supabase-js`.
- `.env.example`: lists the two settings with placeholder values. The real values go in
  `.env.local`.

### What the user sets up (guided step by step at build time)

1. A free Supabase project. Copy its Project URL and publishable key into `.env.local`.
2. Supabase → Authentication → URL configuration: Site URL `http://localhost:5173`, redirect URL
   `http://localhost:5173/**`.
3. Google Cloud: an OAuth client (Web application) with origin `http://localhost:5173` and the
   redirect URI copied from Supabase's Google provider page. Then paste the client ID and secret
   into Supabase → Providers → Google.

## Verification

- TDD for `friendlyAuthError`, `shouldPlayIntro`, `claimLegacyData` (copies all tables once; a
  second account gets nothing; an empty legacy database does nothing), and each welcome screen
  state's text and buttons (static render).
- The existing 195 tests keep passing. Tests that create their own database are unaffected.
- Browser run with a real Supabase project, once the user has set it up:
  - sign up with the user's email, confirm, then the intro plays once;
  - log out, then log in: no intro;
  - wrong password shows the friendly error;
  - forgot password, email link, set a new password, log in;
  - Google sign-in;
  - two accounts on one browser see separate data.
- Screenshots of every welcome state, in both themes and at phone width.
