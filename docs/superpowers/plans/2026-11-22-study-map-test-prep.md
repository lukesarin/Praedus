# Study Map Test Prep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the study map with a per-class springy tree (class → weeks → assignments) where picking a test highlights the weeks it covers, with a review checklist and planned review time beside it.

**Architecture:** Pure, tested modules decide everything: which items are tests (`src/study/testItems.ts`), weeks and units (`src/map/units.ts`), the graph (`src/map/graph.ts`) and panel wording (`src/map/panelText.ts`). The sync keeps aged-out history (`src/db/importFeed.ts`). React components (`StudyMap.tsx`, new `TestPrepPanel.tsx`) only render and forward clicks; `App.tsx` owns the picked class and test.

**Tech Stack:** React 19, TypeScript, Dexie, d3-force, d3-polygon (new, for the hull), d3-zoom, Vitest (node env, `*.test.ts` only).

**Spec:** `docs/superpowers/specs/2026-11-22-study-map-test-prep-design.md` (read it first; the preview it was picked from is `design-exploration/study-map-tests.html`, option B).

## Global Constraints

- Never rename `StudyBlocksDB`, any `sb-*` class, the localStorage keys `studyblocks.theme` / `studyblocks.mapFilters` / `praedus.legacyClaimedBy`, or the sample feed's `PRODID`. `studyblocks.mapFilters` is simply no longer read.
- Student-owned fields (`done`, `userEdited` content, `estimateMinutes`, `reviewed`, course colors, study blocks) are never overwritten by a sync.
- Test titles match `/\b(test|exam|midterm)\b/i`; a bare "final" is not a test; an event whose title also matches `/\b(review|session|office hours|help)\b/i` is not a test.
- Weeks run Monday–Sunday. The map shows at most 20 weeks per class.
- Mint (`--accent`) only for: reviewed, the current week, the planner button, the class pill. The unit region uses the course color; red only for "not turned in".
- Copy is plain, sentence case, no all-caps labels.
- Done means: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` all pass (the chunk-size warning is pre-existing).
- Commit after each task on branch `feature/study-map-test-prep`; never push or merge.

## Review Focus

1. **A new user whose previous test aged out of the feed.** Test 3 then looks like the first test; the panel must not claim "since the start of term" — it says "since Oct 26, the earliest work Praedus has for this class" (no first day of classes set). Pinned in Task 6.
2. **Teacher re-publishes the same exam as an assignment and an event** (same title, same day). Must show one tag, not two. Pinned in Task 5.
3. **A sync right after the student ticks "reviewed".** The tick must survive both the update path and the aged-out path. Pinned in Task 3.
4. **Two tests in the same or adjacent weeks** (e.g. Midterm Mon, Test 2 Fri of the next week). The later unit is empty; the panel shows an empty-unit message, not a crash or a negative range. Pinned in Task 5.
5. **Canvas descriptions with HTML and huge text.** The panel shows plain, short text. Pinned in Task 6.

---

### Task 1: Dragging a node never highlights page text

**Files:**
- Modify: `src/app/theme.css` (the `.map-canvas svg` rule, ~line 1579)
- Test: `src/app/theme.test.ts`

- [ ] **Step 1: Write the failing test** in `theme.test.ts`:

```ts
it('the study map never selects page text while dragging', () => {
  const css = readFileSync(new URL('./theme.css', import.meta.url), 'utf8')
  const rule = /\.map-canvas svg\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
  expect(rule).toMatch(/(^|;|\s)user-select:\s*none/)
  expect(rule).toMatch(/-webkit-user-select:\s*none/)
})
```

- [ ] **Step 2:** `npx vitest run src/app/theme.test.ts` → FAIL.
- [ ] **Step 3:** Add `user-select: none; -webkit-user-select: none;` to `.map-canvas svg`, with a one-line comment: node drags use their own pointer handlers, which (unlike d3-zoom's background drag) don't stop the browser's text selection.
- [ ] **Step 4:** Test passes.
- [ ] **Step 5:** Commit `fix(map): dragging a node no longer highlights the page`.

### Task 2: Know which items are tests, and plan study time for test events

**Files:**
- Create: `src/study/testItems.ts`, `src/study/testItems.test.ts`
- Modify: `src/study/plan.ts:114` (assignment filter), `src/study/coverage.ts:20` (filter), `src/app/ItemDetail.tsx` (show the estimate and study rows when `isPlannable(item)`, not only for assignments)
- Test: `src/study/plan.test.ts`, `src/study/coverage.test.ts`

**Interfaces — Produces:**
- `isTest(item: Pick<CalendarItem, 'kind' | 'title'>): boolean`
- `isFinal(item: Pick<CalendarItem, 'kind' | 'title'>): boolean` — `isTest` and title matches `/\bfinal\b/i`
- `isPlannable(item: Pick<CalendarItem, 'kind' | 'title'>): boolean` — `kind === 'assignment' || isTest(item)`

- [ ] **Step 1: Write failing tests** in `testItems.test.ts` (use a helper `a(title)` for assignments, `e(title)` for events):
  - `isTest`: true for `a('Test 3')`, `a('Midterm exam')`, `a('Final exam')`, `e('Midterm Exam')`; false for `a('Essay 1 final')`, `a('Quiz 4')`, `a('Testing lab')` (word boundary: "Testing" ≠ "test"), `e('Exam review session')`, `e('Midterm office hours')`, `e('Test help')`.
  - `isFinal`: true for `a('Final exam')`, `e('FINAL EXAM')`; false for `a('Test 3')`, `a('Final project')`.
  - `isPlannable`: true for `a('Lab 9')`, `e('Midterm Exam')`; false for `e('Office hours')`.
- [ ] **Step 2: Write failing tests** in `plan.test.ts` (`planStudy places blocks before a test that is a calendar event`: an event titled `Midterm Exam` starting 3 days from `now`, nothing else → `add` has blocks for its id, all ending before its start, totalling 240 min) and `coverage.test.ts` (`coverage includes upcoming test events`: same event → one entry with `estimate` 240).
- [ ] **Step 3:** Run all three files → FAIL.
- [ ] **Step 4:** Implement `testItems.ts`; replace `i.kind === 'assignment'` with `isPlannable(i)` in the planner and coverage filters; in `ItemDetail.tsx` use `isPlannable(item)` for the estimate/study rows (the "Done" checkbox stays assignment-only).
- [ ] **Step 5:** `npm test` → all pass (existing planner tests unchanged).
- [ ] **Step 6:** Commit `feat(study): treat exams posted as calendar events as tests and plan study time for them`.

### Task 3: Keep a semester of history, and save "reviewed"

**Files:**
- Modify: `src/db/db.ts` (`CalendarItem`), `src/db/importFeed.ts`, `src/assignments/group.ts`
- Test: `src/db/importFeed.test.ts`, `src/assignments/group.test.ts`

**Interfaces — Produces:**
- `CalendarItem.reviewed?: boolean` — student-owned; "reviewed for a test", independent of `done`.
- `CalendarItem.keptAsHistory?: boolean` — set by sync when a past item aged out of the feed.
- `importFeed(db, feedId, parsed, now = new Date()): Promise<ImportResult>`; `ImportResult` gains `history: number` (items kept as history this sync).

- [ ] **Step 1: Write failing tests** in `importFeed.test.ts` (import with `now = new Date('2026-12-10T12:00:00Z')`, items from the existing fixtures re-dated as needed):
  - `keeps a past assignment that drops out of the feed as history` → still in `db.items`, `keptAsHistory: true`, `removedFromSource: false`, result `history: 1`, `removed: 0`.
  - `keeps a done past assignment as history, not as removed` → `keptAsHistory: true`, `removedFromSource: false`, `done: true`.
  - `keeps a past test event as history but deletes other past events` → event `Midterm Exam` kept; event `Review session` deleted.
  - `still deletes a future assignment that drops out` (not done) → gone; and a future done one → `removedFromSource: true` (today's behavior).
  - `clears keptAsHistory when the item comes back` → re-import containing it → `keptAsHistory` falsy.
  - `keeps reviewed through an update` → set `reviewed: true`, re-import same item with a new title → title updated, `reviewed: true`.
  - `keeps the study blocks of items kept as history`.
- [ ] **Step 2: Write a failing test** in `group.test.ts`: `leaves out assignments kept as history` → an overdue item with `keptAsHistory: true` appears in no group.
- [ ] **Step 3:** Run → FAIL.
- [ ] **Step 4:** Implement. In the missing-item loop: `const past = dueInstant(old) <= now.getTime()`; if `past && (old.kind === 'assignment' || isTest(old))` → put `{ ...old, keptAsHistory: true, removedFromSource: false }` and count `history`; otherwise today's branches. In the update branch carry `reviewed` like `estimateMinutes`, and write `keptAsHistory: false`. `groupAssignments` skips `keptAsHistory` items. No Dexie version bump (fields aren't indexed).
- [ ] **Step 5:** `npm test` → all pass.
- [ ] **Step 6:** Commit `feat(sync): keep assignments and tests that age out of Canvas's 30-day feed`.

### Task 4: "First day of classes" setting

**Files:**
- Modify: `src/db/settings.ts`, `src/study/StudySettingsForm.tsx` (props + one date input), `src/commitments/ConflictsView.tsx` (pass the value through), `src/app/App.tsx` (live-query it)
- Test: `src/db/settings.test.ts` (create if missing, same db setup as `importFeed.test.ts`)

**Interfaces — Produces:**
- `getTermStart(db: StudyBlocksDB): Promise<string | undefined>` — a `YYYY-MM-DD` key or undefined; settings key `'termStart'`.
- `setTermStart(db: StudyBlocksDB, date: string | undefined): Promise<void>` — undefined or an invalid value deletes the row.
- `normalizeTermStart(value: unknown): string | undefined` — accepts only a real calendar date `YYYY-MM-DD`.

- [ ] **Step 1: Write failing tests:** normalize accepts `'2026-08-24'`, rejects `'2026-13-01'`, `'Aug 24'`, `42`, `undefined`; set then get round-trips; set `undefined` clears it.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement; add a "First day of classes" `<input type="date">` with a "Clear" button under the study settings ("Optional. Numbers the weeks on the study map."). **Step 4:** Tests pass, typecheck passes.
- [ ] **Step 5:** Commit `feat(settings): optional first day of classes`.

### Task 5: Weeks, tests and units

**Files:**
- Create: `src/map/units.ts`, `src/map/units.test.ts`

**Interfaces — Consumes:** `isTest`, `isFinal` (Task 2); `itemDateKey`, `addDays`, `localDateKey` from `src/calendar/dates.ts`; `dueInstant` from `src/study/plan.ts`.

**Interfaces — Produces:**

```ts
export const MAX_WEEKS = 20
export type Week = { start: string /* Monday, YYYY-MM-DD */; number?: number /* from the first day of classes, 1-based */ }
export type Unit = {
  test: CalendarItem
  previous?: CalendarItem        // the class's test before this one, if the app has it
  weeks: Week[]                  // may be empty (back-to-back tests)
  items: CalendarItem[]          // the class's non-test assignments due in those weeks, by due date
  cumulative: boolean            // a final
  earliestKnown?: string         // date key of the class's earliest item, set when the unit may start before the app's history
}
export function mondayOf(dateKey: string): string
export function classWeeks(classItems: CalendarItem[], termStart?: string): Week[]
export function testsOf(classItems: CalendarItem[]): CalendarItem[]
export function unitFor(test: CalendarItem, classItems: CalendarItem[], weeks: Week[], termStart?: string): Unit
export function defaultPick(courses: Course[], items: CalendarItem[], now: Date): { courseId: string; testId?: string } | null
```

Rules (from the spec): `classWeeks` runs from `mondayOf(termStart)` if set, else from the Monday of the earliest item, to the Monday of the latest item, every week included even if empty, numbered from `termStart` when set, keeping the most recent `MAX_WEEKS`. `testsOf` returns tests sorted by `dueInstant`, collapsing a same-title, same-day assignment+event pair into the event. A unit's weeks are those strictly after the previous test's week and strictly before the test's own week; a final's run from the first week. `earliestKnown` is set when there is no `previous` and no `termStart`, or when `termStart` is set and the class's earliest item falls after the unit's first week. `defaultPick`: the soonest upcoming test across all classes; else the alphabetically first class that has items, with its latest test (or none); `null` if no class has items.

- [ ] **Step 1: Write failing tests** (dates in a fall term starting Mon 2026-08-24; helper builders for assignments/events by week and weekday):
  - `mondayOf('2026-08-30')` (a Sunday) → `'2026-08-24'`; `mondayOf('2026-08-24')` → itself.
  - `classWeeks` with items in weeks 9 and 13 and no termStart → 5 weeks starting `2026-10-19`, no numbers; with termStart `2026-08-24` → 13 weeks, last `number: 13`; with 25 weeks of items → 20 weeks, the most recent.
  - `testsOf` → Test 1, Test 2, Test 3 in order; an assignment "Midterm exam" and an event "Midterm exam" on the same day → one, the event.
  - `unitFor(Test 3 in week 14, previous Test 2 in week 8)` → weeks 9–13, items = the problem sets and quizzes in 9–13, `previous` = Test 2; excludes the tests themselves and any events.
  - The author's example: Test 2 in week 3, Test 3 in week 7 → weeks 4, 5, 6.
  - First test (week 4) with termStart → weeks 1–3, no `earliestKnown`; without termStart → `earliestKnown` = the earliest item's date.
  - Final in week 16 → `cumulative: true`, weeks 1–15.
  - Back-to-back: Midterm in week 8, Test 2 in week 9 → Test 2's unit has `weeks: []`, `items: []`.
  - Same-week tests: both in week 8 → the later one's unit is empty, never negative.
  - `defaultPick` with Math Test 3 on Nov 24 and CS Final on Dec 9, now Nov 21 → `{ courseId: math, testId: Test 3 }`; with all tests past → first class alphabetically with its latest test; ENGL only (no tests) → `{ courseId: engl }`; no items → `null`.
- [ ] **Step 2:** `npx vitest run src/map/units.test.ts` → FAIL. **Step 3:** Implement. **Step 4:** Pass.
- [ ] **Step 5:** Commit `feat(map): weeks, tests and the units each test covers`.

### Task 6: Panel wording

**Files:**
- Create: `src/map/panelText.ts`, `src/map/panelText.test.ts`

**Interfaces — Consumes:** `Unit`, `Week` (Task 5).
**Interfaces — Produces:**
- `countdown(due: number, now: Date): string` — `'today'`, `'tomorrow'`, `'in N days'`, `'yesterday'`, `'N days ago'`, by calendar day.
- `coverLine(unit: Unit): string`
- `weekHeading(week: Week): string` — `'Week 9'` when numbered, else `'Week of Oct 19'`.
- `plainDescription(text: string | undefined, max = 140): string` — strips tags, decodes `&amp; &lt; &gt; &quot; &#39; &nbsp;`, collapses whitespace, cuts at a word boundary with `…`.

- [ ] **Step 1: Write failing tests:**
  - `countdown`: due Tue Nov 24 10:00, now Sat Nov 21 12:00 → `'in 3 days'`; same day → `'today'`; due Nov 22 → `'tomorrow'`; past Sep 15 → `'67 days ago'`.
  - `coverLine`: numbered weeks 9–13, previous Test 2 → `'Covers weeks 9 to 13, since Test 2'`; unnumbered → `'Covers Oct 19 to Nov 22, since Test 2'`; cumulative → `'Covers the whole semester'`; no previous and `earliestKnown: '2026-10-26'` → `'Covers everything since Oct 26, the earliest work Praedus has for this class'`; first test with termStart → `'Covers weeks 1 to 3, since the start of term'`; empty weeks → `'Nothing due between Midterm exam and this test'`.
  - `plainDescription('<p>Read <b>ch. 4</b> &amp; answer&nbsp;Q1–3</p>')` → `'Read ch. 4 & answer Q1–3'`; a 500-char string → ≤ 141 chars ending in `…`; `undefined` → `''`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** Pass.
- [ ] **Step 5:** Commit `feat(map): plain wording for the test prep panel`.

### Task 7: The class graph

**Files:**
- Rewrite: `src/map/graph.ts`, `src/map/graph.test.ts` (old ring/window tests are deleted with the code they test)
- Delete: `src/map/useMapFilters.ts`

**Interfaces — Consumes:** Task 5 (`classWeeks`, `testsOf`, `unitFor`, `Week`, `Unit`), `isTest`.
**Interfaces — Produces:**

```ts
export type NodeKind = 'course' | 'week' | 'assignment' | 'test'
export type MapNode = {
  id: string            // `course:<id>`, `week:<monday>`, `item:<id>`
  kind: NodeKind
  refId: string         // course id, monday key, or item id
  label: string         // course code, week label ("9" or "Oct 19"), or title
  week?: string         // monday key, for week, assignment and test nodes
  inUnit: boolean       // inside the picked test's unit
  picked?: boolean      // the picked test
  now?: boolean         // the current week
  status?: 'done' | 'late'
  reviewed?: boolean
}
export type MapLink = { source: string; target: string; kind: 'spine' | 'spoke' | 'item' }
export function buildClassGraph(input: { course: Course; items: CalendarItem[]; termStart?: string; testId?: string; now: Date }):
  { nodes: MapNode[]; links: MapLink[]; weeks: Week[]; tests: CalendarItem[]; unit?: Unit }
export function courseCode(name: string): string   // kept as is
```

Includes only the course's assignments and test events. `spine` links join consecutive weeks, `spoke` links join the course to each week, `item` links join an item to its week. `late` = past due, not done, not a test.

- [ ] **Step 1: Write failing tests:** with the fall-term fixture for MATH: one course node, 16 week nodes, 15 spine links, 16 spokes; every assignment and test has an item link to its week; with Test 3 picked, `inUnit` is true exactly for weeks 9–13 and their assignments, `picked` only on Test 3; the week containing `now` has `now: true`; a past undone assignment is `late`, a done one `done`; a `reviewed` item carries `reviewed: true`; other courses' items and non-test events are excluded; `courseCode` tests kept.
- [ ] **Step 2:** FAIL. **Step 3:** Implement; delete the ring code, `useMapFilters.ts` and their tests. **Step 4:** `npx vitest run src/map` passes (App won't typecheck until Task 8; that's expected).
- [ ] **Step 5:** Commit `feat(map): one class as weeks and assignments`.

### Task 8: The map, the panel and wiring

Use the frontend-design skill for this task. Match preview B in `design-exploration/study-map-tests.html` (its CSS and render code are the reference for marks, sizes and the hull).

**Files:**
- Rewrite: `src/map/StudyMap.tsx`
- Create: `src/map/TestPrepPanel.tsx`
- Modify: `src/app/App.tsx`, `src/app/theme.css` (study map section; remove ring styles), `package.json` (`d3-polygon` and `@types/d3-polygon`)

**Interfaces — Consumes:** Tasks 3–7.
**Interfaces — Produces (component props):**
- `StudyMap({ courses, courseId, graph, onPickCourse, onPickTest, onOpenItem, hasTermStart, onSetTermStart })` — `courses`: classes that have items, sorted by name; `graph`: the `buildClassGraph` result.
- `TestPrepPanel({ course, unit, weeks, blocks, items, now, planning, onPlan, onToggleReviewed, onOpenItem })`.

Requirements, all from the spec: toolbar (class segmented control, test buttons with date, quieter past tests, "No tests"); force layout seeded around a circle by week order, class fixed at the center, drag springs back, zoom/pan/Fit kept; tests as clickable tags; the unit as a padded hull in the course color behind everything (mint tint growing with the reviewed share); out-of-unit nodes dimmed; labels for unit items; current week outlined in mint; region fade-in on pick is the only animation (off under `prefers-reduced-motion`). The panel follows spec section 6; "Plan review time" shows only for an upcoming test whose `coverage(...).short > 0` and calls the existing `plan()`; the test's planned blocks are listed; ticking calls `db.items.update(id, { reviewed })`; the "Set first day of classes" link calls `onSetTermStart` → `go('conflicts')`. App holds `{ courseId, testId }` in state, initialized and re-initialized (when the picked class disappears) from `defaultPick`. At ≤ 390px the panel stacks below the map.

- [ ] **Step 1:** Add the dependency; build the components and wiring; remove `useMapFilters` and `buildGraph` uses.
- [ ] **Step 2:** `npm run typecheck && npm run lint && npm test && npm run build` → all pass.
- [ ] **Step 3:** Commit `feat(map): test prep map and panel`.

### Task 9: Check it in the browser

**Files:** a temporary, git-ignored harness only (delete afterwards).

- [ ] **Step 1:** Seed a browser profile with a fall term (the preview page's data: MATH with Tests 1–3 + final, CS with a midterm and a final as a calendar event, ENGL with none, Problem Set 11 not done, two items kept as history) via a dev-only page or DevTools `Runtime.evaluate` on the running app, and open the study map in headless Chrome (CLAUDE.md: Node + DevTools Protocol, no dependencies).
- [ ] **Step 2:** Screenshot in dark and light, at full width and 390px: default pick is Math Test 3; switch to CS (the event final is a tag); ENGL shows "No tests"; tick two items (dots and region turn mint, the count updates); press Plan review time (blocks appear); open an item from a dot.
- [ ] **Step 3:** Drag a node off the map edge across the sidebar and confirm `getSelection().toString() === ''`.
- [ ] **Step 4:** Assignments page: items kept as history don't appear.
- [ ] **Step 5:** Fix anything found (as its own commit), delete the harness, report what was checked and what needs a human (real Canvas data, a real trackpad).
