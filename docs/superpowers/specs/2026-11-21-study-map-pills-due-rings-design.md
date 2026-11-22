# Study map: mint pills + due-date rings — design

Status: approved and built (see "Changes during build") · Date: 2026-11-21

## Intent

Make the study map say *when*, not just *what*: courses become mint pills (option A in
`design-exploration/study-map.html`), and each assignment sits at a distance from its course that
matches how soon it's due, with faint "This week" and "Next week" rings (option D). The user chose
this combination.

## Goals

1. Course nodes are rounded mint-outlined pills showing a short course code ("CS 210"), with the
   full name in the filter chips, the tooltip and the accessible label.
2. Assignment distance from its course encodes days until due. Overdue work sits closest, then this
   week, then next week, then later.
3. Two faint dashed guide rings per course, labeled "This week" and "Next week" when zoomed in
   enough for labels.
4. Study blocks become tiny mint dots, keeping mint for "yours" as in the rest of the app.

## Non-goals

No change to what the map includes (window, filters, statuses), to click and hover behavior, or to
any data. No new settings.

## Anti-goals

- The map becomes huge or unreadable because work is due weeks away.
- Dragging stops working, or nodes snap around jarringly.
- Course pills overlap each other's labels.

## Approach

Considered:

1. **Spring length by due date (chosen).** The existing link force already pulls each assignment
   toward its course. Its target length becomes the due-date distance, so the hub carries its rings
   with it, nodes stay draggable, and they ease back to their ring when released.
2. **A radial force around a fixed center.** This only works for one center, but the map has one
   hub per course. Rejected.
3. **Pinning nodes at computed positions.** It kills the springy feel and dragging. Rejected.

## Design

### Distance scale (`src/map/graph.ts`, pure and tested)

`ringDistance(daysUntilDue: number): number`, compressed so 8 weeks still fits:

| Due | Distance from course center |
|---|---|
| Overdue (< 0) | 34 |
| 0–7 days | 46 → 109 (9 per day) |
| 7–14 days | 109 → 172 (9 per day) |
| 14–56 days | 172 → 239 (1.6 per day) |

`RING_THIS_WEEK = 109`, `RING_NEXT_WEEK = 172`. Days are counted from the start of today to the
due instant (the same `dueInstant` the planner uses), as fractional days.

`MapNode` gains `dueInDays?: number` for assignment nodes.

`courseCode(name: string): string` matches a leading subject + number ("CS 210", "MATH 120",
"ENGL 101A"). Otherwise it returns the name, shortened to 16 characters with "…".

### Rendering (`src/map/StudyMap.tsx`, `theme.css`)

- **Link distance**: assignments use `ringDistance(dueInDays)`, with link strength raised (0.35 →
  0.7) so distances read clearly. Classes keep 44, blocks 14.
- **Course node**: a pill (height 28, radius 14, width from the code's length) with a
  `--accent-soft` fill, a 1.5px `--accent` stroke and the code in `--accent` at 13px / 700. The
  collide radius is about half the pill width plus padding. Course charge is stronger (−800 → −1400)
  so neighboring ring sets overlap less.
- **Guide rings**: per visible course, two dashed circles (`--map-link`, 1px, dash 3 5) at the ring
  distances, drawn under links. Labels sit at the top of each ring in `--text-faint` at 10.5px, only
  at zoom ≥ `LABEL_ZOOM`.
- **Assignments**: unchanged dots in course color, sized by estimate, with labels and the
  Overdue / Needs-time tags.
- **Study blocks**: fill `--accent` at 75% opacity (they were course-colored).
- **Classes** (when shown): unchanged squares.
- **Tooltip**: courses now get the tooltip too, showing the full name and "N upcoming assignments".
- The legend adds "Rings: this week · next week".

### Behavior preserved

Filters, hover highlighting, course focus on click, click-to-open, drag, zoom and Fit are all
unchanged.

## Verification

- TDD for `ringDistance` (overdue, day 0, day 7, day 14, day 56 and beyond, monotonic),
  `courseCode` ("CS 210 Intro to Programming" gives "CS 210", "ENGL 101A Composition" gives
  "ENGL 101A", "Biology" gives "Biology", a long name with no code gets shortened), and `buildGraph`
  setting `dueInDays` (an overdue item is negative, an item due in 3 days is about 3).
- Full suite, typecheck, lint and build.
- Browser screenshots of the map with sample data, the test shift and a plan, in both themes, plus
  a drag of an assignment showing it springs back toward its ring.

## Changes during build

Found in the browser check and fixed:

- **Scale recalibrated** so it starts outside the course pill. The first numbers put overdue work
  inside the pill, and collisions pushed due-tomorrow work past the "This week" ring. Now overdue is
  60, then 72 + 8 per day for 0–14 days, then 1.6 per day up to day 56 (251). Rings sit at 128 and
  184. Days count from *now*, matching the map's overdue rule.
- **Courses are spaced by a hub-only force** (minimum distance 1.9 × the next-week ring) in place
  of a strong charge, which also pushed each course's own assignments off their rings. Course charge
  is −300 and assignment springs are 0.9.
- **Ring labels show only for the course you hover or focus,** placed on the side facing the middle
  of the map with a background-colored halo. Always-on labels sat on top of assignment labels.

Measured with sample data: overdue work at 67; work due in 1–5 days at 95–120 (inside 128); work
due in 9–13 days at 147–173 (between 128 and 184). An assignment dragged out to 139 returned to 94
within 3 seconds.
