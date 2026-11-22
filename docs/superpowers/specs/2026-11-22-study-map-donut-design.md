# Study map: donut — design (short)

Status: awaiting approval · Date: 2026-11-22
Changes: `2026-11-22-study-map-test-prep-design.md` — replaces its section 5 (the map) and reshapes
section 6 (the panel). Everything else in that spec stands as built: test detection (including
exam events), units, kept history, `reviewed`, the first day of classes, Plan review time.
Preview: `design-exploration/study-map-pie.html`, option **A. Donut** (picked by the author).

## Intent

After trying the springy tree, the author wants to move away from the node web: something
**clean and professional**, one class at a time, shaped like a pie: the class in the center, the
semester split into weeks around it. The panel lists the class's upcoming tests; picking one
highlights the weeks it covers. The end goal is an AI study set made from those weeks, so the
panel gets the step where the student confirms the topics the AI will take in, ready for the AI to
plug into later.

## Approaches

| Option | Trade-off | Decision |
|---|---|---|
| A. Donut: equal week slices, dots for work | Cleanest; weeks always in the same place | **Picked by the author** |
| B. Sunburst: weeks inside, one slice per assignment outside | Shows most, busier | Not chosen |
| C. Workload pie: slice length = hours | Shows heavy weeks, less calm | Not chosen |
| D. Semester track (columns) | Most readable, not a pie | Not chosen |
| Earlier: all classes on one map (free-floating / islands) | Node web the author moved away from | Not chosen |

Study set step: build the topic step now with **Create study set** disabled and "AI study sets
are coming with Premium" (author's choice), rather than a bare button or nothing.

## Design

**Header (above the chart):** a class dropdown (course color dot, "MATH 120 · Calculus I"),
"Week 13 of 16" (or the week's date when no first day of classes is set), and a short legend.
Classes listed are those from `mapCourses`. Default: the class with the soonest upcoming test,
with that test picked (`defaultPick`). Changing class picks its next upcoming test (or none).

**The donut (SVG, no simulation, no dragging):** one slice per visible week (`classWeeks`,
up to 20), equal angles, starting at twelve o'clock and running clockwise, with a small gap
between slices. Inside: the class code, full name and "Week N of M". Each slice shows its week
number (or a short date) near the outer edge and one dot per assignment, stacked from the inside
out (done faded, late with a red ring, reviewed mint). Covered weeks fill with the course color;
others are a quiet neutral, alternating two shades. The current week has a mint outline. Tests
are labels outside the rim at the point in the week they fall, with a short tick; clicking one
picks it. Hovering a slice or dot shows its week or title (SVG title is enough). Picking a test
fades the fill in; nothing else animates; no animation under reduced motion. The chart scales to
the space and stays readable at 390px (the panel stacks below).

**The panel:** "Upcoming tests" for the class: each test with name, date, countdown, and "Covers
weeks 9–13" (or the date range, or "Covers the whole semester"). Past tests sit below under "Past
tests", quieter. Picking a test (or its rim label) highlights its weeks and opens, under the list:
Make a study set (upcoming tests only), the reviewed meter, Plan review time / planned blocks (as
built), the missing-history note when relevant, and the checklist by week (as built). Picking the
picked test again unselects it. Empty states: class with no tests; unit with nothing to review.

**Study set step:** Make a study set replaces the detail with a step titled "Study set for Test
3": a line saying the topics come from the N assignments in the covered weeks, then the topics as
removable chips (each covered assignment's title; its first line of description as a tooltip), an
"Add a topic" field, a disabled **Create study set** button, "AI study sets are coming with
Premium.", and Back. Topics aren't saved yet (saving comes with the AI).

**Removed:** the springy tree, d3-force map code, hull, label placement, Fit, drag, zoom, and the
`d3-polygon` dependency if nothing else uses it.

## Left to the builder

Exact radii, gaps and font sizes (match preview A); how the dot stacks shrink when a week has
many items (cap with "+N"); the label collision rule for two tests in one week.

## Verification

Pure geometry helpers (slice angles, week index for a date, test label position) get unit tests;
existing units/panelText/graph-free tests keep passing. Browser check with the demo semester in
both themes at full width and 390px: default pick, switching classes, picking tests from the
panel and the rim, ticking items (dots turn mint), Plan review time, the study set step (remove
and add a topic), and that nothing on the page gets selected when clicking around the chart.
