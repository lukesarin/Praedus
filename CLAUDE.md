# Praedus

A student planner (formerly StudyBlocks). It brings in Canvas deadlines through each student's
calendar-feed link, works around their classes and shifts, plans study time a little each day,
and shows coursework on a study map. React 19 + TypeScript + Vite, FullCalendar 6, Dexie
(IndexedDB), d3-force, a small Hono "feed helper" server, and Supabase Auth.

README.md covers running, setup and how features behave. `docs/superpowers/specs/` (the why) and
`plans/` (the how) exist for every change. Read the relevant spec before changing a feature.

## Where things stand (2026-11-22)

- **`main`** (pushed to GitHub): the Praedus rebrand, Connect Canvas (feed link plus auto-sync)
  and the **study map as a donut**. It shows one class at a time (dropdown), with weeks as equal slices
  and assignments as dots (5 max, then "+N"). Tests sit on the rim, picking one fills the weeks it
  covers, and the current week has a mint outline. Clicking a week opens a **week card** in the
  nearest free chart corner, joined to the week by a thin line, listing what was due and its topic.
  The panel has "Upcoming tests", review detail, Plan review time, and a **study set step**: topics
  as removable chips, with a disabled "Create study set" and "AI study sets are coming with Premium."
  Topics aren't saved yet; saving comes with the AI. Pure logic lives in `src/map/donut.ts`
  (`buildDonut`, `cardSpot`) and `panelText.ts` (`studySetTopics`). d3 is gone. Specs:
  `2026-11-22-study-map-donut-design.md`, `…-week-card-design.md`.
- **Branch `auth/accounts`** (pushed, not merged into `main`): accounts, project 1 of 3. It has the
  Statement welcome screen, email/password sign-in, a login gate, a once-per-account "dot opens the
  app" intro, per-account local databases and a sidebar account row. `main` was merged into it
  (2026-11-22), so it also has the donut. Sign-up and log out were tested and work.
  - Not yet done: **Google sign-in setup** (the user postponed it; steps were given in chat and
    are in the README: a Google Cloud OAuth client with origin `http://localhost:5173` and the
    Supabase callback `https://<project>.supabase.co/auth/v1/callback`, then the Supabase Google
    provider plus URL Configuration) and a test of password reset and two accounts. Merge into
    `main` after that, with the user's OK.
  - A copy of the app started from `main` has no accounts, so there's no Log out. To try accounts,
    run the app from `auth/accounts`.
  - **AI study sets (merged into `auth/accounts` 2026-11-22, not on `main`):** a notes drop area per
    class (PDF, photos, pasted text, sorted into weeks; Dexie table `notes`), and study sets made by
    Claude through the feed helper (`POST /api/study-set/week`, Supabase sign-in check, 30 weeks a day
    per user in memory, key `ANTHROPIC_API_KEY` in `.env.local`, read only by the server). Sets go
    **week by week**: each topic has a lesson (overview + worked example), then A–D problems; "I'm
    stuck" shows the solution under the problem and counts as skipped; 3 right in a row learns a
    topic, 2 misses bring the lesson back, 8 without the streak marks it for review. Math is LaTeX
    drawn with KaTeX (`MathText`, loaded lazily with the session). Code: `src/notes/`,
    `src/studySet/` (`weekSession.ts` rules, `store.ts`, `shape.ts` shared with `server/`),
    `server/claude.ts` (model `claude-opus-5-5`, code execution checks math answers). Specs:
    `2026-11-22-ai-study-sets-design.md`, `…-study-session-weeks-design.md`. Real runs: about 70–85 s
    and $0.20 per week. While a week is made, a waiting screen shows timed steps and a bar (option B of
    `design-exploration/study-wait.html`; timed estimates, not real progress). `vite.config.ts`
    pre-bundles KaTeX, or the dev server reloads the page the first time a set opens.
  - **Next (the author's plan):** more changes to study sets, to be described by the author. Then Google sign-in setup and the remaining account tests.
  - **Intro fix (on `auth/accounts`):** the app's main area had no background, so the intro showed
    through it. The logo lingered over the revealed app and the circle reveal was invisible until
    a hard cut. Now `.app-root` has `background: var(--bg)`, guarded by a test in
    `src/app/theme.test.ts`. **Keep `.app-root` opaque.**
  - **Open choice for the user (offered, not decided):** optional intro polish:
    1. a thin mint ring on the reveal circle's edge (in dark mode the app and intro share
       `#0E0E0E`, so the edge only shows where it crosses content);
    2. tighter timing (about 3s from sign-in to app now; about 2.2s possible);
    3. a dev-only replay link (e.g. `?intro`), since the intro plays once per account.
  - **Testing the intro without real accounts:** a temporary page (an `intro-harness.html` at the
    root that renders `AuthGate` with a stand-in client) replays Supabase's real event order:
    `INITIAL_SESSION`, `SIGNED_IN`, then `USER_UPDATED` after `updateUser`. Record a timeline (wave
    `strokeDashoffset`, dot scale, `.app-root` clip-path) every 100ms through a pre-load script.
    Check WebKit as well as Chrome: a small Swift `WKWebView` script works, but its window must be
    on screen, since hidden windows get throttled. Delete the harness afterwards. In dev, React
    StrictMode runs the intro effect twice (doubled animations); this doesn't happen in production.
- **Next, project 2: cloud save.** Everything (feeds, items, courses, commitments, settings,
  study blocks) gets saved to the account in Supabase and restored on any device. Keep Dexie as
  the fast local copy and sync on top (last write wins per record). Supabase tables need
  row-level security so each user sees only their own rows. Account deletion belongs here.
- **Then project 3: going live** (the user wants this last). It covers hosting on Vercel or
  similar (the feed helper becomes a serverless function) and a custom SMTP provider (e.g. Resend),
  since Supabase's built-in email only reaches project team members, about 2/hour. It also means
  adding the production URL to Supabase redirect URLs and Google OAuth origins, and these loose
  ends:
  - **turn "Confirm email" back on** in Supabase (the user turned it off temporarily for testing);
  - set Supabase's minimum password length to 8, to match the app's copy.

## Commands

```bash
npm run dev        # app on http://localhost:5173 + feed helper on :8787
npm test           # Vitest (node environment; only *.test.ts files run)
npm run typecheck && npm run lint && npm run build
```

All four must pass before a task counts as done. The build's chunk-size warning existed before
these changes; ignore it.

## Rules that protect existing data and behavior

- **Never rename** the `StudyBlocksDB` class, the `sb-*` CSS classes, the localStorage keys
  `studyblocks.theme` / `studyblocks.mapFilters` / `praedus.legacyClaimedBy`, or the sample
  feed's `PRODID`. Doing so would lose or orphan saved data.
- The legacy database is `studyblocks`. Per-account databases are `praedus-<userId>`, and `db`
  in `src/db/db.ts` is a live binding swapped by `openUserDatabase`.
- `importFeed` merge rules: student-owned fields (done, edits, estimates, course colors, study
  blocks) are never overwritten by a sync.
- Canvas comes in **only through the calendar-feed link**. Canvas's API policy forbids asking
  users for personal access tokens, and OAuth needs per-school approval. Grades and submission
  status are deliberately out of scope.
- Secrets live in `.env.local` (git-ignored): `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_…`, safe in the app). **Never** put a
  `sb_secret_…` key in the app or the repo, and never ask the user to paste keys into chat.

## Brand and design

- Name: **Praedus** ("PRAY-dus"). Wordmark: lowercase `praedus` in Figtree.
- Mark: "Cadence", a wave that lands on a dot (`LogoIcon` in `src/app/icons.tsx`, 48-unit grid).
- Font: Figtree everywhere (`@fontsource-variable/figtree`, bundled).
- Color: mint on near-black. Dark `#0E0E0E` background with `#5ED3A8` mint. The light theme
  uses `#0B7F58`. Tokens live at the top of `src/app/theme.css`, and contrast is guarded by
  `src/app/theme.test.ts`.
- Rule: **mint means "yours or now"**: study blocks, today, the now line, the planner button and
  course pills on the map. Red is for conflicts, amber for warnings.
- Layout direction is "Hairline": quiet surfaces, 1px rules, no heavy shadows.
- Design explorations live in `design-exploration/` (static HTML, not loaded by the app).

## Working with this user

- They make decisions by **seeing options**. Before visual changes, build a preview page in
  `design-exploration/` with 3–4 distinct options on real app data, open it for them, and
  recommend one. Previous rounds: `index.html` (brand/colors), `study-map.html`, `welcome.html`.
- Explain in **plain language** and keep answers short. When they ask "how do I open/try this",
  run `open <file or URL>` for them and give the one or two clicks needed.
- They use the Superpowers workflow: brainstorm → short design doc → plan → build with TDD on a
  **separate branch per feature**, so everything stays reversible.
- **Commit, merge, push or delete only when they say so.** Things only they can do (Supabase or
  Google dashboards, GitHub settings, deleting repos or users) get step-by-step guidance, not
  attempts.
- Playwright isn't installed. For browser checks, drive headless Chrome via the DevTools
  Protocol with a small Node script (no dependencies): click, drag, screenshot, in both themes and
  at 390px width.
- After UI work, say what was verified in the browser and what still needs a human test.
