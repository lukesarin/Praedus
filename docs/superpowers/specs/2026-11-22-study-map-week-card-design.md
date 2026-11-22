# Study map: week card — design (short)

Status: approved (option A picked by the author) · Date: 2026-11-22
Builds on: `2026-11-22-study-map-donut-design.md`. Preview: `design-exploration/week-card.html`, option **A**.

## Intent

The donut's dots don't say what a week covered, which the author found confusing. Clicking a week
should show what was due that week and what it covered, without leaving the chart.

## Approaches

| Option | Trade-off | Decision |
|---|---|---|
| A. Card in the nearest free corner, joined to the week by a thin line | Clearly tied to the week; covers some other weeks | **Picked** |
| B. The donut's hole becomes the week | Calm, but 3 items max, topics cut | Not chosen |
| C. Drawer from the bottom of the chart | Most room; eye jumps away from the slice | Not chosen |
| D. Hover peek + click to pin | Fast scanning; no hover on phones, busier | Not chosen |

## Design

- Clicking a week slice (or one of its dots) opens its card; the slice gets a strong outline. Clicking
  the same week, empty chart space, the card's ×, or pressing Esc closes it. Changing class or test
  closes it. Clicking another week switches.
- Card: "Week 10" + "Oct 26 to Nov 1"; tags "This week" (mint) and "On Test 3" (course tint) when they
  apply. Then every item due that week (work and tests), in due order: status mark (course-color dot,
  faded when done, red ring when not turned in, mint when reviewed, square for a test), the title
  (clicking opens the item's details, as dots used to), the first line of its description, and the
  weekday with "Done" / "Not turned in" / "Reviewed" / "Test". Empty week: "Nothing was due this week."
- Placement: the chart corner nearest the week whose card covers neither the week's outer edge nor
  its middle; a 1.25px line runs from the week's outer edge to the card's nearest edge, with a small
  dot at the week end. Width 300px (less on narrow screens). Opening fades/scales in once (none
  under reduced motion).

## Left to the builder

Exact corner margins, card max height (scrolls inside), keyboard focus (slices focusable, Enter opens).
