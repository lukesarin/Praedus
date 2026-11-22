# Study map: test prep — design

Status: awaiting approval (builder check done) · Date: 2026-11-22
Replaces: `2026-11-21-study-map-pills-due-rings-design.md` (and the map parts of milestone 4)
Preview: `design-exploration/study-map-tests.html`, option **B. Springy tree** (picked by the author)

## Intent

The study map felt useless: it showed the same things as the calendar and the assignment list,
just arranged differently, and three restyles didn't fix that. The author wants the map to have a
job. The job: **help a student prepare for a test.**

The map becomes a tree per class: the class in the center, its **weeks** around it, and each
week's **assignments** hanging off the week. Tests split the semester into **units**: a test
covers the weeks since the previous test (the author's example: Test 2 in week 3 and Test 3 in
week 7 means Test 3 covers weeks 4–6). Picking a test highlights its unit on the map and opens a
panel listing what it covers, so the student can tick items off as reviewed and plan review time.

The author's long-term goal is a premium **AI study guide** built from the unit's assignments.
That is out of scope here (it needs a server and payments, so it comes after going live), but the
panel reserves its spot.

## Goals

1. The study map shows one class at a time as a springy, draggable tree: class → weeks →
   assignments, covering the whole semester the app knows about, not just the next 8 weeks.
2. Tests are found automatically, and each test's unit (the weeks it covers) is drawn as a soft
   shaded region around those weeks.
3. A side panel for the picked test says when it is, what it covers (grouped by week, with each
   assignment's Canvas description), and how much has been reviewed.
4. Students can tick assignments off as **reviewed**. Ticks are saved, survive Canvas syncs, and
   turn the region and the dots mint.
5. **Plan review time** puts study time for the test on the calendar using the existing planner.
6. The app keeps a semester's history: assignments that fall out of Canvas's 30-day feed window
   are no longer deleted.
7. Dragging on the map never highlights page text (the reported bug).

## Non-goals

- The AI study guide (later, premium). Only a placeholder line in the panel.
- Letting the student mark something as a test or not a test by hand. Detection is by name only
  for now; a manual override can come later if names prove unreliable.
- The all-classes overview, the due-date rings, course filter chips, "Hide finished work" and
  "Show classes" on the map. They are removed.
- Study block dots on the map. Review time is listed in the panel instead.
- Getting history from before the student connected Canvas (the feed doesn't include it).
- Cloud save of the new fields (project 2 will carry them like every other field).

## Anti-goals (a failure even if it works)

- Students lose data or settings: any rename of `StudyBlocksDB`, `sb-*` classes, the
  `studyblocks.mapFilters` key or the sample `PRODID` (see CLAUDE.md).
- A Canvas sync wipes "reviewed" ticks, or wipes history the student needs for a test.
- Kept history clutters other screens: the Assignments page grows an endless "Overdue" list, or
  the planner or conflicts start treating old work as current.
- The map gets slow or unreadable with a full semester (around 16 weeks × 2–4 items per class).
- Mint used for anything other than "yours or now" (reviewed, the current week, the planner
  button).

## Constraints

- Canvas comes in only through the calendar feed, and **the feed includes only the past 30 days**
  (plus a year ahead). Anything older exists only if the app kept it from earlier syncs.
- `importFeed` merge rules: student-owned fields are never overwritten by a sync. "Reviewed" is a
  new student-owned field.
- Brand and tokens from `src/app/theme.css`. Figtree, Hairline, mint means "yours or now".
- `npm test`, `typecheck`, `lint` and `build` must pass.

## Approaches

**How the new map fits in the app**

| Option | Trade-off | Decision |
|---|---|---|
| 1. Replace the current map | Smallest build, reuses the force simulation, drag and zoom. Loses the all-classes overview (which the author found useless). | **Chosen by the author** |
| 2. Keep both behind an "Overview / Test prep" switch | Nothing lost, but two maps to maintain, and the overview keeps the disliked design. | Not chosen |
| 3. A separate "Test prep" sidebar tab | Easiest to find, but adds a tab, and the old map still needs fixing. | Not chosen |

**How it looks** (from the preview page): A. Clock (weeks around a fixed clock face), B. Springy
tree (weeks as hubs joined in order, draggable), C. Subway lines (every class as a horizontal line).
The author picked **B**.

## Design

### 1. Keeping history (`src/db/importFeed.ts`) — approved by the author

Today an item missing from the feed is deleted unless it is done or edited (then it's kept with
`removedFromSource`). New rule for an **assignment** missing from the feed:

- If it was due **before now**, keep it and mark it `keptAsHistory: true`, whether or not it was
  done or edited. It aged out of Canvas's 30-day window; it wasn't removed by the teacher, so it
  must not get `removedFromSource` or the "Removed from Canvas" label. *(Builder's call, from the
  review: otherwise every finished assignment older than 30 days would be mislabeled.)*
- If it was due in the future, today's behavior stays: deleted, or kept with `removedFromSource`
  when done or edited (the teacher most likely removed it).

The same rule applies to **test events** (see 3). Other calendar events (lectures, office hours)
keep today's behavior; only history the map needs is kept. *(Builder's call.)*

When a kept item shows up in the feed again, clear the flag. Items kept this way are **not**
`removedFromSource`, so they don't get the "Removed from Canvas" label. Study blocks of kept
items are kept too.

`keptAsHistory` items are hidden from the **Assignments page** (otherwise every old undone
assignment would sit in "Overdue" forever). They still appear on past days in the calendar, and
on the study map. They are past due, so the planner and conflict checks already ignore them; the
builder confirms this with a test.

### 2. Reviewed (`CalendarItem.reviewed?: boolean`)

A new optional, student-owned field. It means "I reviewed this for a test", which is separate
from done. The `importFeed` update path must carry it over the way it carries `done` and
`estimateMinutes` (the current code rebuilds the item from the feed, so an unlisted field would be
lost). No Dexie version bump is needed, since the field isn't indexed.

### 3. Tests and units (new pure module, e.g. `src/map/units.ts`)

- **A test** is an assignment **or a calendar event** whose title matches
  `/\b(test|exam|midterm)\b/i`. Many teachers post exams as calendar events ("Midterm Exam,
  Thu 2 PM") rather than assignments; the author chose to count those. A bare "final" doesn't
  count, so "Essay 1 final" isn't a test but "Final exam" is. Quizzes aren't tests (they would
  split units into slivers). Watch for false positives among events, such as "Exam review session"
  in the sample feed: an event whose title also contains "review", "session", "office hours" or
  "help" is not a test. *(Builder's call.)*
- A timed test event is "due" at its start time. If a class has both an assignment and an event
  for the same test (same title, same day), it counts once, preferring the event's time.
- **A final** is a test whose title also contains "final". It is cumulative: it covers the whole
  semester.
- **A test's unit** is the weeks strictly after the previous test's week, up to the week before
  the test's own week (the author's rule). The first test covers from the first week. If two tests
  fall in the same or adjacent weeks, the later one's unit can be empty, and the panel says so.
- The items in a unit are the class's assignments (not tests) due in those weeks, including done
  and `keptAsHistory` ones.

### 4. Weeks

- Weeks run Monday to Sunday (the calendar uses `firstDay={1}`).
- **First day of classes** is an optional setting (one date for the whole term, stored in the
  `settings` table). When it's set, weeks are numbered ("Week 9") from it. When it's not, weeks
  are labeled by date ("Week of Oct 19"). This avoids a wrong "Week 1" for students who connected
  Canvas mid-term. The setting goes in the existing study settings form, plus a quiet "Set first
  day of classes" link in the map's toolbar.
- The map shows a class's weeks from the first day of classes (if set; otherwise the week of the
  class's earliest known item) through the week of its last item, capped at 20 weeks (the most
  recent 20 if longer). Items before the first day of classes are left off. Empty weeks in between still get a hub, so the trail
  stays continuous.
- **Missing history:** if a unit starts before the earliest item the app has for that class, the
  panel says which weeks it has no record of and why ("Praedus has this class's work from Oct 26
  on. Earlier weeks came before you connected Canvas.").

### 5. The map (`src/map/StudyMap.tsx`, `graph.ts`, `theme.css`)

Match preview B. Concretely:

- **Toolbar:** a class switcher (segmented control with course color dots), then the class's tests
  as buttons showing name and date. Past tests read quieter. "No tests" when a class has none.
- **Nodes:** the class pill (mint outline, center, fixed), week hubs (small circles with the week
  number, or small pills with a short date when there's no first day of classes), assignment dots
  in the muted course color, and tests as labeled tags ("Test 3") that are clickable.
- **Links:** week to week in order (this is what makes the trail), week to class (faint), and
  assignment to week.
- **The picked unit:** a soft region in the course color drawn around the unit's weeks and
  assignments (a padded hull), behind everything. Everything outside the unit and the picked test
  dims. Assignment labels show for the unit's items; elsewhere only on hover.
- **Reviewed:** reviewed dots turn mint, and the region gains a mint tint that strengthens as more
  of the unit is reviewed.
- **Status:** done items are faded; past-due, not-done items get a red ring, and the panel says
  "Not turned in" (the map's existing overdue meaning).
- **Now:** the current week's hub has a mint outline.
- **Interaction:** drag any node and it springs back; the class stays fixed. Scroll/pinch to
  zoom, drag the background to pan, and Fit. Clicking a test tag picks it. Clicking an assignment
  opens the existing item detail. Picking a test fades its region in; that's the only animation
  (none under reduced motion).
- **Default on open:** the class with the soonest upcoming test, with that test picked, every
  time the app opens. If no class has an upcoming test, the first class alphabetically with its
  most recent test (or no test). While the app stays open, the picked class and test are kept
  when switching tabs. Nothing is saved between visits, since the soonest test is almost always
  what a student wants. *(Builder's call, from the review.)* The old `studyblocks.mapFilters` key
  is simply no longer read (never renamed or reused).
- **Drag bug:** `user-select: none` on the map's SVG, guarded by a test in the style of
  `src/app/theme.test.ts`. The root cause: d3-zoom blocks text selection for background drags,
  but node drags have their own handler that doesn't, so the browser selected page text.
- Removed: rings, `ringDistance`, the hub-separation force, course chips, the legend's ring entry,
  block and class nodes, and their tests.

### 6. The panel (new component beside the map)

Match preview B's panel:

- The test name (large), then the class code, date and a countdown ("in 3 days", mint while
  upcoming).
- What it covers: "Covers weeks 9 to 13, since Test 2" (or the date range when weeks aren't
  numbered; "Covers the whole semester" for a final).
- "N of M reviewed" with a thin mint bar.
- **Plan review time** (upcoming tests only). See 7.
- The unit's assignments grouped by week. Each shows a round tick box (mint when checked), the
  title, a "Not turned in" flag when relevant, and the Canvas description as plain text (first
  line or two; descriptions can be long or HTML-ish, so strip tags and truncate).
- A quiet placeholder: "Study guide, coming with Premium."
- Empty states: no tests in this class; a unit with no items; missing history (see 4).
- On narrow screens (≤ 390px), the panel stacks under the map.

### 7. Plan review time

A test that is an assignment is already planned for, with a default estimate of 4 hours
(`src/study/estimate.ts`). **Test events are new to the planner:** `planStudy` and `coverage`
(both filter on `kind === 'assignment'` today) also take events that count as tests, due at their
start. The item detail shows the estimate field for test events too. This means the sidebar's
**Plan my study time** also gives event-only exams study time, which the author approved.
Conflict checks are unchanged. Review time is simply the test's own study time:

- The panel shows the test's planned study blocks ("Sun, Nov 22 · 7:00 – 8:30 PM") and any time
  still missing (from `coverage`).
- **Plan review time** runs the existing `planMyStudyTime` (the same as the sidebar button), then
  shows what was planned for this test, using the same summary wording. If nothing is missing, the
  button is hidden and the blocks are listed.
- The student changes how much review time a test gets through the existing estimate field in
  the item detail.

## Left to the builder

- Hull padding, force strengths and node sizes, tuned until it looks like preview B with a real
  semester's data.
- How descriptions are cleaned (tag stripping and truncation length).
- Component and file split, and whether the panel is shared with the item detail styles.
- Exact copy for empty states, within the voice above.

## Verification

- TDD for the pure parts: test detection, finals, units (first test, a final, back-to-back tests,
  no tests), week numbering with and without a first day of classes, the 20-week cap,
  missing-history detection, the history-keeping merge (past item kept and flagged, future item
  deleted, flag cleared on return, `reviewed` survives an update), the Assignments page hiding
  kept history, and the map graph builder.
- The drag-select CSS guard test.
- Full suite, typecheck, lint and build.
- In headless Chrome: the map with sample data spread over a semester, in both themes and at
  390px. Pick tests, tick items, plan review time, and drag a node off the page edge, confirming
  nothing on the page gets highlighted.
- Needs a human: real Canvas data, and dragging with a real mouse and trackpad.
