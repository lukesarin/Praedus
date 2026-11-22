# Praedus

A planner for students, in mint on black. It pulls your Canvas
assignments into one calm calendar, alongside your classes, work shifts and other
commitments, flags when things clash, plans your study time around all of it, and
shows how your coursework connects on an Obsidian-style study map.

**Status:** Milestones 1–4 are done: calendar + .ics import, commitments + conflicts,
auto-scheduler, and study map. Milestone 5 (Canvas API) is next.

## Run it

Needs Node 20+.

```bash
npm install
npm run dev        # app on http://localhost:5173 + feed helper on :8787
npm test           # unit tests (Vitest)
npm run typecheck
npm run build
```

No Canvas account? Click **Try sample data** on the start screen. To see conflicts,
click **Load test work shift** in the sidebar's Commitments section. Then press
**Plan my study time**.

To bring in your real Canvas: click **Connect Canvas**, then in Canvas open
**Calendar → Calendar Feed**, copy the link and paste it in. It works at any school with no
approval needed. Praedus re-syncs on its own while it's open: on launch, every 30 minutes, and
when you return to the tab. You can also upload any `.ics` file with the **+** next to Calendars.

## How it works

- **Local-first.** Everything a student imports is stored in their own browser
  (IndexedDB via Dexie). There are no accounts and no database on our side.
- **Feed helper** (`server/`). Canvas doesn't let web pages read calendar feeds from
  other sites (CORS), so a tiny stateless server fetches them for the app. It only
  accepts `https://…/feeds/calendars/*.ics` links, refuses private network addresses,
  caps size (5 MB) and time (10 s), and **never stores or logs feed URLs**. Those links
  work like passwords.
- **Re-syncing never loses your stuff.** Items are matched by their `.ics` UID. Your
  "done" marks and course colors are never overwritten. If something vanishes from
  Canvas after you marked it done, it's kept and labeled "Removed from Canvas".
- **Commitments** (milestone 2) are classes, shifts and anything else you have to be at,
  either one-time or weekly. They're stored as rules with local wall-clock times, so a
  4 pm shift stays at 4 pm across daylight saving. Dragging a weekly one asks "This week
  only" (saves an exception for that date) or "Every week" (changes the rule).
- **Conflicts.** Red means two commitments overlap, or a timed deadline lands during one.
  Amber means two commitments are less than N minutes apart (default 10, set on the
  Conflicts page, 0 turns it off). Only your own commitments count. Imported Canvas
  events like optional review sessions never do. Checked from the start of today through
  8 weeks ahead. Earlier days aren't flagged, so old clashes don't clutter things.
- **Commitments in the sidebar** are listed by when they next happen. Finished one-time
  items and ended series are dimmed at the bottom.
- **Study planning** (milestone 3). "Plan my study time" handles the earliest deadline
  first. It starts today and spreads a little each day (one chunk per day, 30 min–2 h),
  inside study hours, under a daily limit, and around commitments plus a buffer. Only
  your own commitments count as busy. Estimates come from the title (quiz 1 h, project
  6 h, …) and can be changed per assignment. All-day deadlines finish the day before.
  Re-planning only replaces the planner's own future blocks. Dragged blocks are pinned,
  past blocks count as studied, and blocks of finished assignments stay, crossed out.
  It never re-plans on its own. Settings live on the Schedule page.
- **Study map** (milestone 4, restyled as a "clean diagram") is a springy graph (d3-force,
  drawn as SVG) with muted dots, thin gray links, and names beside the dots (course names
  above). Status shows as small "Overdue" / "Needs 2 h" tags. It shows courses,
  upcoming assignments (due today through 8 weeks, plus unfinished overdue work from
  the last 2 weeks), their study blocks, and optionally class commitments (squares).
  Dot size follows the time estimate.
  Filters (course chips, hide finished, show classes) are remembered in the browser.
- **Deadlines vs. time blocks.** Canvas assignments are deadlines, so they sit in the
  "Due" row of the day they're due (in your time zone). Events with real times are blocks
  on the grid.

```
src/
  app/          shell, sidebar, theme, item details dialog
  calendar/     FullCalendar view, item/commitment → event mapping, date helpers
  commitments/  commitment rules, expansion, conflicts, move/delete, form, Schedule page
  study/        estimates, planner, coverage, study settings, block dialog
  map/          study map graph builder, d3-force view, filters
  assignments/  assignment list + grouping
  import/       .ics parsing, Canvas mapping, sample feed, import/sync actions, dialog
  db/           Dexie schema, import merge rules, course colors
server/         feed helper (Hono)
docs/superpowers/specs/   design doc (the "why" and the full plan)
docs/superpowers/plans/   per-milestone implementation plans
```

**Stack:** React 19 + TypeScript + Vite · FullCalendar 6 (free MIT plugins) · ical.js ·
Dexie · d3-force/d3-zoom · Hono · Vitest. Planned: Tauri as an optional desktop build.

## Roadmap

| # | Milestone | Status |
|---|---|---|
| 1 | **MVP:** calendar (week/month/agenda), Canvas link + `.ics` import, re-sync, assignment list with done, course colors, dark/light theme, sample data | ✅ Done |
| 2 | **Commitments + conflicts:** one-time/weekly classes, shifts and other commitments, drag/resize with "this week / every week", red conflicts (overlaps, deadlines during commitments), amber back-to-back warnings with an adjustable gap, test work shift button | ✅ Done |
| 3 | **Auto-scheduler:** "Plan my study time" button, start-early spreading, flexible 30 min–2 h chunks, buffer around commitments, study hours + daily limit, editable estimates, pinned (dragged) blocks, crossed-out blocks for finished work, "needs more study time" list | ✅ Done |
| 4 | **Study map:** Obsidian-style graph of courses ↔ upcoming assignments ↔ study blocks (+ optional classes), status rings, hover focus, click-through, filters | ✅ Done |
| 5 | **Canvas API:** optional access token, point values, submission status, auto-sync | ⏭ Next |
| 6 | **Polish + launch:** deploy (static site + serverless helper), export to Google/Apple Calendar, installable PWA, optional account sync | |

## Decisions so far

- **For students in general, not just one person.** That's why approach A was chosen:
  local-first, so we hold no student data. Accounts with sync (Supabase) are an add-on in
  milestone 6, not the foundation.
- **d3-force instead of Cytoscape** for the study map (milestone 4), for the live,
  springy Obsidian feel and theming through the same CSS variables.
- **TypeScript over Python**, because the app is mostly an interactive UI that runs in
  the browser.
- **Hosting is decided at launch** (milestone 6). Until then everything runs locally.
- **No walking/travel time between places** (decided in milestone 2). The single
  adjustable back-to-back gap covers "I need a few minutes to get there".

## Picking this up later

1. Read the design doc: `docs/superpowers/specs/2026-11-20-studyblocks-design.md`.
2. Check the roadmap above for the next milestone, and write its plan in
   `docs/superpowers/plans/`.
3. `npm test` should be green before and after each change.

## Known limits

- Canvas syncs only while Praedus is open. Grades and submission status aren't available: the
  calendar link doesn't include them, and the Canvas API needs school approval.
- Uploaded `.ics` files can't re-sync. Upload the newer file instead.
- Recurring events in non-Canvas calendars are expanded from 1 year back to 1 year ahead
  (max 500 occurrences each).
- Commitments can't run past midnight (e.g. a 10 pm–2 am shift), and repeat only weekly.
- "Every week" changes apply to the whole series, past weeks included.
- The planner doesn't add breaks between back-to-back study blocks for different
  assignments. A dropped (dragged) block can sit on top of others until the next re-plan.
- The feed helper checks DNS before fetching but doesn't pin the resolved IP. That's fine
  locally; tighten it before public deployment (milestone 6).
