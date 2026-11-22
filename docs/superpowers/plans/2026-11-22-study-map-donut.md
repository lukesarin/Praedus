# Study Map Donut Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the springy-tree study map with a donut (one class at a time, picked from a dropdown; week slices around the class; tests on the rim) and reshape the panel into an "Upcoming tests" list with the existing review detail plus a new study set topic step.

**Architecture:** A pure, tested model (`src/map/donut.ts`) turns one class's items into slices, dots and rim labels with angles; `StudyMap.tsx` only draws it as static SVG. `TestPrepPanel.tsx` gains the tests list and the study set step; topic gathering is a pure tested helper. Units, kept history, `reviewed`, term start and planning are unchanged.

**Tech Stack:** React 19, TypeScript, SVG (no simulation), Vitest (node env, `*.test.ts` only).

**Spec:** `docs/superpowers/specs/2026-11-22-study-map-donut-design.md` (changes sections 5–6 of `2026-11-22-study-map-test-prep-design.md`, which still governs everything else). Visual reference: option A in `design-exploration/study-map-pie.html`.

## Global Constraints

- Never rename `StudyBlocksDB`, any `sb-*` class, the localStorage keys `studyblocks.theme` / `studyblocks.mapFilters` / `praedus.legacyClaimedBy`, or the sample feed's `PRODID`.
- Mint (`--accent`) only for: reviewed, the current week, the planner and study set buttons, focus rings. Covered weeks use the course color; red only for "not turned in".
- Copy is plain, sentence case, no all-caps labels. Study set copy: "Study set for <test>", "Create study set" (disabled), "AI study sets are coming with Premium.", "Back", "Add a topic".
- Picking a test fades its weeks' fill in; that's the only animation (none under `prefers-reduced-motion`).
- `.map-canvas svg` keeps `user-select: none` (guarded by `src/app/theme.test.ts`).
- Done means: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` all pass (the chunk-size warning is pre-existing).
- Commit after each task on `feature/study-map-test-prep`; never push or merge.

## Review Focus

1. **A week with many items** (e.g. 7 in one week): at most `MAX_DOTS` dots plus a "+N" count, never spilling past the slice. Pinned in Task 1.
2. **Two tests in the same week** (e.g. a quiz-day midterm and a Friday exam): rim labels must not sit on each other. Pinned in Task 1 (label offset rule).
3. **A class with 20 weeks** (cap) vs 3 weeks (connected late): slices still equal and readable; 3 weeks must not draw three giant wedges with labels off-chart. Pinned in Task 1 (angles for any count) and checked in Task 3.
4. **Picked test from another class after switching the dropdown**: the pick resets to the new class's next upcoming test, never shows another class's unit. Pinned in Task 2 (App wiring) and checked in Task 3.
5. **Study set with an empty unit** (back-to-back tests): Make a study set is hidden, not a step with zero topics. Pinned in Task 2.

---

### Task 1: The donut model

**Files:**
- Create: `src/map/donut.ts`, `src/map/donut.test.ts`
- Move: `isLate` and `courseCode` (and their tests) from `src/map/graph.ts` / `graph.test.ts` into `donut.ts` / `donut.test.ts`
- Delete: `src/map/graph.ts`, `src/map/graph.test.ts`, `src/map/labels.ts`, `src/map/labels.test.ts` (StudyMap.tsx/TestPrepPanel.tsx/App.tsx will not typecheck until Task 2 — accepted)

**Interfaces — Consumes:** `classWeeks`, `testsOf`, `unitFor`, `mapItems`, `mondayOf`, `Week`, `Unit` from `src/map/units.ts`; `weekHeading` from `src/map/panelText.ts`; `dueInstant`; `isTest`.
**Interfaces — Produces:**

```ts
export const MAX_DOTS = 5
export type DonutDot = { item: CalendarItem; status?: 'done' | 'late'; reviewed: boolean }
export type DonutWeek = {
  week: Week; label: string        // weekHeading-style short label: "9" or "Oct 19"
  a0: number; a1: number           // radians, 0 = twelve o'clock, clockwise; gap already applied
  inUnit: boolean; now: boolean
  dots: DonutDot[]                 // at most MAX_DOTS, in due order
  more: number                     // items beyond MAX_DOTS
}
export type DonutTest = { item: CalendarItem; angle: number; picked: boolean; past: boolean; lane: 0 | 1 }
export type Donut = { weeks: DonutWeek[]; tests: DonutTest[]; unit?: Unit }
export function isLate(item: CalendarItem, now: Date): boolean        // moved, unchanged
export function courseCode(name: string): string                      // moved, unchanged
export function sliceAngles(index: number, count: number, gap?: number): [number, number]
export function buildDonut(input: { course: Course; items: CalendarItem[]; termStart?: string; testId?: string; now: Date }): Donut
```

Rules: weeks from `classWeeks` (any count 1–20) split the full circle equally starting at twelve o'clock; `gap` defaults to 0.012 rad on each side and is reduced so a slice never vanishes. Dots are the week's non-test assignments. A test's `angle` is its week's `a0` plus the fraction of that week (Mon 00:00 → Sun 24:00) at its due time, so it sits where it falls. `lane` is 1 for a test within 0.12 rad of an earlier test (labels then sit further out), else 0. `picked`/`unit` follow `testId` exactly like the old `buildClassGraph` (a `testId` not among visible tests → no unit). Labels: numbered weeks use the number, else "Oct 19".

- [ ] **Step 1: Write failing tests:** `sliceAngles(0, 16)` starts at `0 + gap` and `sliceAngles(15, 16)` ends at `2π - gap`; 3 weeks → each ≈ 2π/3 wide; 20 weeks → equal widths; `buildDonut` on the fall-term MATH fixture: 16 weeks, weeks 9–13 `inUnit` with Test 3 picked, `now` only on the current week, week dots match items, a week with 7 items → 5 dots and `more: 2`, Test 3's angle lies inside week 14's slice and after its `a0`, two tests in one week → second has `lane: 1`, statuses (done, late with the all-day rule, reviewed), other classes' items excluded, moved `isLate`/`courseCode` tests still pass.
- [ ] **Step 2:** `npx vitest run src/map/donut.test.ts` → FAIL. **Step 3:** Implement; delete the old files. **Step 4:** `npx vitest run src/map` and `npm test` pass; `npm run lint` passes.
- [ ] **Step 5:** Commit `feat(map): donut model for one class's semester`.

### Task 2: Donut chart, tests panel and study set step

Use the frontend-design skill. Match option A of `design-exploration/study-map-pie.html` (its CSS and `renderDonut`/`panelHtml`/`detailHtml` are the reference), in the app's real tokens.

**Files:**
- Rewrite: `src/map/StudyMap.tsx` (header with class dropdown + "Week N of M" + legend; static SVG donut drawn from `buildDonut`; rim labels clickable; SVG `<title>` hovers; dot shows "+N" text when `more > 0`)
- Modify: `src/map/TestPrepPanel.tsx` (tests list → detail as built → study set step), `src/map/panelText.ts` + test (`studySetTopics`), `src/app/App.tsx` (wiring; dropdown change re-picks via `defaultTestFor`), `src/app/theme.css` (map section: drop tree/zoom/hull/label styles; add donut, dropdown, tests list, study set styles), `package.json` (remove `d3-force`, `d3-zoom`, `d3-selection`, `d3-polygon` and their `@types` only if nothing else imports them — grep first)

**Interfaces — Produces:**
- `studySetTopics(unit: Unit): { id: string; title: string; hint: string }[]` in `panelText.ts` — one per unit item, `hint` = `plainDescription(desc, 80)`.
- `StudyMap({ courses, courseId, donut, onPickCourse, onPickTest, onOpenItem, hasTermStart, onSetTermStart, now })`
- `TestPrepPanel({ course, tests, unit, weeks, blocks, short, now, planning, onPlan, onPickTest, onToggleReviewed, onOpenItem })` — `tests`: the class's visible tests.

Requirements (spec): panel title "Upcoming tests", upcoming tests (name, date, countdown, cover line) then "Past tests" quieter; picking the picked test unselects; detail shows Make a study set (upcoming tests with a non-empty unit only), meter, plan block, missing-history note, checklist; Make a study set swaps the detail for the study set step (chips removable, "Add a topic" adds a chip, disabled Create, Premium line, Back); topics are component state, reset when the test changes. Clicking a dot opens the item detail. Dropdown lists `mapCourses`; header shows "Week N of M" when numbered, else "Week of Oct 19". At ≤ 760px the panel stacks below and the donut fits the width.

- [ ] **Step 1: Write failing test** for `studySetTopics` (titles in due order, hint stripped of HTML and ≤ 81 chars, empty unit → []). **Step 2:** FAIL. **Step 3:** Implement helper, components, wiring, CSS. **Step 4:** `npm run typecheck && npm run lint && npm test && npm run build` pass.
- [ ] **Step 5:** Quick headless-Chrome sanity screenshots (scratchpad only). Commit `feat(map): donut study map, tests panel and study set step`.

### Task 3: Check it in the browser

Seed the demo semester into IndexedDB `studyblocks` (as in the previous plan's Task 9; scripts in the scratchpad only), then in headless Chrome, dark and light, 1440px and 390px: default pick (soonest test), switching classes in the dropdown (pick resets), picking tests from the panel and from the rim, unselecting, ticking items (dots turn mint), Plan review time, Make a study set (remove a topic, add one, Back), a 3-week class (connect-late case) and a 7-items week (+N), and that clicking/dragging over the chart selects no page text. Fix real problems as small commits; report what still needs a human.
