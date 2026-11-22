# Accounts, Welcome and Intro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Supabase-backed login (email/password + Google), the Statement welcome screens, a once-per-account intro, and per-account local data.

**Architecture:** A new `AuthGate` (in `src/auth/`) wraps the unchanged `App`. It watches the Supabase session, opens the account's own Dexie database, and shows the welcome screens, the intro or the app. `db` in `src/db/db.ts` becomes a live binding, so the 10 modules that import it are untouched.

**Tech Stack:** React 19, TypeScript, Dexie 4, `@supabase/supabase-js` 2.x, Vitest (node environment, `*.test.ts`), fake-indexeddb.

**Spec:** `docs/superpowers/specs/2026-11-21-accounts-welcome-intro-design.md`

## Global Constraints

- Env: `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, set in `.env.local` (git-ignored). Commit only `.env.example`.
- Log out uses `signOut({ scope: 'local' })`.
- The intro flag is `user_metadata.praedus_intro_seen === true`, set with `updateUser({ data: { praedus_intro_seen: true } })`.
- Database names: `praedus-<userId>`; legacy `studyblocks`. The claim marker is localStorage `praedus.legacyClaimedBy`.
- Exact copy as in the spec. Statement layout: headline "Your semester,\nin rhythm.", body "Praedus brings in your Canvas deadlines, works around your classes and shifts, and plans a little study time each day."
- No edits to existing features beyond `db.ts`, `main.tsx`, `Sidebar.tsx`, `App.tsx` (Sidebar props only) and `theme.css`.
- Branch `auth/accounts`. Commit per task.

## Review Focus

1. **Two accounts on one browser:** account B must not receive A's legacy data. Pinned by the `claimLegacyData` test.
2. **No legacy database at all:** claiming must not create an empty `studyblocks` database. Pinned by the test.
3. **Supabase not configured:** the setup message renders, with no crash. Pinned by a static render test.
4. **Network down during login:** shows a friendly error. Pinned by the `friendlyAuthError` test for a fetch failure.
5. **Reload mid-intro:** the flag is set when the intro starts, so a reload never replays it. Set in `AuthGate` before playing; checked in the browser run.

---

### Task 1: Pure auth helpers

**Files:** Create `src/auth/authErrors.ts` (with tests) and `src/auth/intro.ts` (with tests).

- `friendlyAuthError(err: { message?: string; code?: string; status?: number } | unknown): string`. Each match gives:
  - `invalid_credentials` / "Invalid login credentials": "That email and password don't match."
  - `user_already_exists` / "already registered": "An account with that email already exists. Log in instead."
  - `email_not_confirmed`: "Confirm your email first; we sent you a link."
  - `weak_password` / "Password should be": "Use a password with at least 8 characters."
  - `over_email_send_rate_limit` / status 429: "Too many emails were sent just now. Try again in a little while."
  - a `TypeError` or "Failed to fetch": "Couldn't reach Praedus. Check your connection and try again."
  - anything else: "Something went wrong. Try again."
- `shouldPlayIntro(user: { user_metadata?: Record<string, unknown> } | null): boolean`. True only for a user without `praedus_intro_seen === true`.

Steps: write the tests, run them (FAIL), implement, run them (PASS), `npm test`, commit.

### Task 2: Per-account database

**Files:** Modify `src/db/db.ts`. Create `src/db/accountDb.test.ts`.

- `export let db = new StudyBlocksDB()` (unchanged default for code paths outside the gate).
- `openUserDatabase(userId: string): StudyBlocksDB`. Closes the previous instance if its name differs, sets `db = new StudyBlocksDB(\`praedus-${userId}\`)`, and returns it.
- `claimLegacyData(target: StudyBlocksDB, userId: string, legacyName = 'studyblocks', storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage): Promise<'claimed' | 'none' | 'taken'>`:
  - `'taken'` if the marker is already set (no copy);
  - `'none'` if `Dexie.exists(legacyName)` is false, or the legacy tables are all empty (no database gets created);
  - otherwise copies every table into the target, but only when every target table is empty. Then it sets the marker to `userId` and returns `'claimed'`.
- Tests (fake-indexeddb, in-memory storage stub):
  - claimed copies feeds, items, courses, commitments, settings and studyBlocks;
  - a second user gets `'taken'` and an empty database;
  - no legacy database gives `'none'`, and `Dexie.exists` stays false afterwards;
  - `openUserDatabase` names the database `praedus-<id>` and updates the exported `db`.

### Task 3: The gate, welcome screens, intro and account row

**Files:** Create `src/auth/supabase.ts`, `AuthGate.tsx`, `WelcomeScreen.tsx`, `WelcomeScreen.test.ts`, `Intro.tsx` and `.env.example`. Modify `src/main.tsx`, `src/app/Sidebar.tsx`, `src/app/App.tsx` and `src/app/Sidebar.test.ts`.

- `supabase.ts` exports `supabase: SupabaseClient | null`, which is null when either env var is missing.
- `WelcomeScreen` props: `{ mode: 'login' | 'signup' | 'forgot' | 'check-email' | 'new-password'; email?: string; error?: string | null; busy?: boolean; notice?: string | null; onMode; onGoogle; onLogin(email, pw); onSignup(email, pw); onForgot(email); onResend(); onNewPassword(pw) }`. It's presentational, rendering the Statement layout per the spec copy.
- `WelcomeScreen.test.ts` (static render), per mode:
  - login has "Welcome back", "Continue with Google", "Forgot password?" and "Create an account";
  - signup has "Create your account" and "Use 8 or more characters.";
  - check-email shows the email and "Resend email";
  - forgot has "Send reset link";
  - new-password has "Set a new password";
  - an `error` prop renders inside `role="alert"`.
- `SetupNeeded` (a static export in `WelcomeScreen.tsx`): the text "Praedus isn't connected to its account service yet." with the two env var names. Tested.
- `AuthGate`:
  - With no client, render `SetupNeeded`. Otherwise, on `INITIAL_SESSION`/`SIGNED_IN`, run `openUserDatabase` and `claimLegacyData`.
  - If `shouldPlayIntro`, call `updateUser` to set the flag, then render `<Intro onDone/>` over the app.
  - Otherwise render `<App account={{ email, onLogOut }} />`. `PASSWORD_RECOVERY` gives the new-password mode, and `SIGNED_OUT` gives the welcome screen.
  - `redirectTo` / `emailRedirectTo` are `window.location.origin`.
- `Intro`: the preview's sequence (950ms draw, a 380ms pause, a 380ms dot pop, a 300ms hold, then a 650ms circle reveal of the app). A click or any key skips it. With reduced motion, it's a 500ms fade.
- `App` takes an optional `account` prop and passes it to `Sidebar`, which renders the account row (email plus "Log out") in its footer when present. Add a Sidebar test.

Steps: tests first where listed, then implement, `npm test`, typecheck, lint and build, then commit.

### Task 4: Styles, README, browser check

- `theme.css`:
  - the `.welcome` Statement layout (two columns; one column below 820px, with the headline at 40px);
  - the auth card, fields, Google button, primary button, alerts and the faint giant mark;
  - `.intro` stage styles;
  - the account row.
- README: a "Set up accounts" section (the three steps from the spec) and a note on the email limit.
- Browser run with dummy env (`VITE_SUPABASE_URL=https://praedus-test.invalid`): welcome screens in all modes, both themes and 390px, plus a login attempt showing the friendly network error. Without env: the setup message.
- The real Supabase run (sign up, confirm, intro, log out/in, reset, Google, two accounts) happens with the user once their project exists.
