# Praedus

A student planner (formerly StudyBlocks). It brings in Canvas deadlines through each student's
calendar-feed link, works around their classes and shifts, plans study time a little each day,
and shows coursework on a study map. React 19 + TypeScript + Vite, FullCalendar 6, Dexie
(IndexedDB), d3-force, a small Hono "feed helper" server, and Supabase Auth.

README.md covers running, setup and how features behave. `docs/superpowers/specs/` (the why) and
`plans/` (the how) exist for every change. Read the relevant spec before changing a feature.

## Where things stand (2026-11-21)

- **`main`** (pushed to GitHub): the Praedus rebrand, Connect Canvas (feed link plus auto-sync)
  and the study map (mint course pills plus due-date rings).
- **Branch `auth/accounts`** (not merged): accounts, project 1 of 3. It has the Statement welcome
  screen, email/password sign-in, a login gate, a once-per-account "dot opens the app" intro,
  per-account local databases and a sidebar account row. Sign-up was tested and works.
  - Not yet done: **Google sign-in setup** (Google Cloud OAuth client plus the Supabase provider;
    steps in the README) and a full test of log out/in, password reset and two accounts. Merge
    after that, with the user's OK.
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
