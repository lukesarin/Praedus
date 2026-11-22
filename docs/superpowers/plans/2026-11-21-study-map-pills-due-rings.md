# Study Map Pills + Due Rings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mint course pills, with assignments placed by due date inside faint "This week" / "Next week" rings.

**Architecture:** Pure helpers and the new `dueInDays` field live in `src/map/graph.ts` (tested). `StudyMap.tsx` uses them for link distances, the pill shape, the guide rings and tooltips, and `theme.css` styles them. No data changes.

**Tech Stack:** React 19, d3-force/d3-zoom (SVG), Vitest.

**Spec:** `docs/superpowers/specs/2026-11-21-study-map-pills-due-rings-design.md`

## Global Constraints

- Distances (recalibrated during the build; see the spec's "Changes during build"): overdue 60; 0–14 days 72 + 8·d; 14+ days 184 + 1.6·(d−14), capped at day 56 (251.2). `RING_THIS_WEEK = 128`, `RING_NEXT_WEEK = 184`.
- `dueInDays = (dueInstant(item) − now) / 86_400_000`. **Ruling vs. spec:** the spec says "from the start of today". Counting from *now* keeps distance consistent with the map's existing overdue rule (`dueInstant <= now`).
- Assignment link strength 0.7, course charge −1400, class distance 44, block distance 14.
- Pill: height 28, rx 14, `--accent-soft` fill, 1.5px `--accent` stroke, code in `--accent` at 13px / 700.
- Branch `map/pills-rings`. Commit per task.

## Review Focus

1. **Item due far beyond 8 weeks** (can't happen through the filter, but must not explode): capped. Tested.
2. **Assignment with no course:** no link, so no ring distance. It must still render. Existing test.
3. **Course name with no code** ("Biology", a long name): readable pill. Tested.
4. **Dragging:** the node springs back to its ring distance. Browser check.
5. **Many courses:** rings overlap faintly; the pills mustn't overlap. Collide radius uses the pill's half-width.

---

### Task 1: Graph helpers and `dueInDays`

**Files:** Modify `src/map/graph.ts` and `src/map/graph.test.ts`.

**Produces:** `ringDistance(days: number): number`, `RING_THIS_WEEK`, `RING_NEXT_WEEK`, `courseCode(name: string): string`, and `MapNode.dueInDays?: number` (assignments only).

- [ ] **Step 1: Write failing tests.**
  - `ringDistance`: −2 gives 34; 0 gives 46; 7 gives 109; 14 gives 172; 56 gives 239.2 (≈); 120 gives the same as 56; strictly increasing on [0, 56].
  - `courseCode`: "CS 210 Intro to Programming" gives "CS 210"; "ENGL 101A Composition" gives "ENGL 101A"; "MATH 120" gives "MATH 120"; "Biology" gives "Biology"; "Introduction to Modern Philosophy" gives "Introduction to…" (16 characters including the …).
  - `buildGraph`: `item:late` has `dueInDays` < 0; `item:lab` (due 2026-11-25 23:59, now 2026-11-21 12:00) has `dueInDays` ≈ 4.5; block nodes have no `dueInDays`.
- [ ] **Step 2:** `npx vitest run src/map/graph.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement. `courseCode` regex: `/^([A-Za-z]{2,6})[\s-]*(\d{2,4}[A-Za-z]?)\b/`, then join the two parts with one space.
- [ ] **Step 4:** Tests pass; `npm test` green. Commit.

### Task 2: Render pills, rings, mint blocks and the course tooltip

**Files:** Modify `src/map/StudyMap.tsx` and `src/app/theme.css`.

**Consumes:** the Task 1 exports.

- [ ] **Step 1:** In the simulation:
  - Link distance for an assignment's link is `ringDistance(dueInDays ?? 2)`, at strength 0.7.
  - `CHARGE.course` is −1400.
  - The course collide radius is `pillWidth / 2 + 10`, where `pillWidth = code.length * 7.6 + 28`.
- [ ] **Step 2:** Drawing:
  - A `<g className="map-rings">` before the links: for each course node, two dashed circles at `RING_THIS_WEEK` and `RING_NEXT_WEEK`, plus labels at their tops when zoom ≥ `LABEL_ZOOM` (and not dimmed by focus).
  - The course node draws a `rect` pill plus a centered code `text`. The course's old top label is removed from `map-labels`.
  - Block nodes use `var(--accent)` in place of `muted(color)`.
  - The tooltip also shows for courses: the full name, then "N upcoming assignments", counted from links.
  - The legend gets a "Rings: this week · next week" item.
- [ ] **Step 3:** CSS: `.map-ring` (stroke `var(--map-link)`, dasharray `3 5`, no fill); `.map-ring-label` (fill `var(--text-faint)`, 10.5px); `.map-node.kind-course .pill` and `.pill-text` per the constraints. Hover and focus states give the pill a stroke width of 2.
- [ ] **Step 4:** `npm test && npm run typecheck && npm run lint && npm run build`. Expected: green. Commit.

### Task 3: Browser check

- [ ] **Step 1:** In both themes: sample data, the test shift, Plan, then the Study map. Screenshot it. Check that the pills don't overlap, the rings show with labels, the mint block dots render, overdue work sits close to its course, and the course tooltip appears on hover.
- [ ] **Step 2:** Drag an assignment outward 150px and release. Record its distance from the course before, while dragged, and 2s after release. Expected: it returns near `ringDistance`.
- [ ] **Step 3:** Fix visual defects, then commit with all checks green.
