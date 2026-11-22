# Praedus rebrand: design

Status: awaiting approval · Date: 2026-11-21

## Intent

Rebrand StudyBlocks as **Praedus** and give it a new visual identity, without changing what the
app does. Every feature, interaction, data rule and stored record must behave exactly as it does
today. This is a restyle, not a rewrite.

The direction was chosen through the exploration in `design-exploration/index.html`:

- **Name:** Praedus (said "PRAY-dus"), written lowercase in the wordmark: `praedus`.
- **Mark:** Cadence, a single wave that lands on a dot (the "S" logo).
- **Type:** Figtree for the wordmark and the whole app.
- **Color:** mint on black. Dark is the main look.
- **Layout:** the "Hairline" direction: keep the current sidebar + calendar structure; hairline
  rules, quiet surfaces, and the accent reserved for what is yours or happening now.

## Goals

1. The app looks like the "Mint on black" preview: near-black ground, Figtree, mint accent,
   Cadence mark, today's date circled in mint.
2. Every visible "StudyBlocks" becomes "Praedus" (title, sidebar, mobile bar, favicon).
3. All existing behavior is unchanged, and all tests, typecheck, lint and build still pass.

## Non-goals

- No new features, views, settings or copy rewrites beyond the brand name.
- No layout restructuring (no top nav, no margin column). The sidebar, its sections and the
  mobile drawer keep their structure.
- No changes to scheduling, conflicts, planning, import/sync, storage or the feed helper.

## Anti-goals (would be a failure even if it "works")

- Existing users lose data or settings because a storage key, database name or ID changed.
- Drag-to-create, drag/resize, or the "This week / Every week" prompt get harder to use because
  event padding or borders changed the hit areas.
- Mint gets confused with a course color, or a warning stops being distinguishable.
- Text that fails WCAG AA contrast (4.5:1 for text, 3:1 for icons and large type).

## Constraints

- Logic in `commitments/`, `study/`, `import/`, `db/` and `server/` is not edited, with one
  proposed exception (see "Course color defaults").
- FullCalendar markup can't change. Styling goes through its `--fc-*` variables and the existing
  `sb-*` / `fc-*` classes in `theme.css`.
- Local-first: the font must be bundled with the app, not loaded from Google Fonts at runtime.
- These must stay unchanged so existing data keeps working: the IndexedDB name `studyblocks`,
  the localStorage keys `studyblocks.theme` and `studyblocks.mapFilters`, the sample feed
  `PRODID`, the `StudyBlocksDB` class name, and the `sb-*` CSS class names.

## Approaches considered

1. **Token restyle (chosen).** Swap the values of the existing CSS variables in `theme.css`,
   adjust the rules that carry the look (today, events, buttons, nav), and make a handful of small
   markup changes (logo, title, favicon). It touches the fewest files and no logic. The current CSS
   is already built on variables (154 uses), so it maps almost one-to-one onto the preview.
2. **Rewrite styling (Tailwind or CSS modules).** Cleaner long term, but it touches every component,
   risks behavior regressions in a "restyle only" job, and adds dependencies. Rejected.
3. **Wrap FullCalendar in custom chrome.** Replace its toolbar and headers with our own components.
   This brings closer control over the today circle and day headers, but it re-implements working
   navigation. Rejected, since CSS can reach those elements.

## Design decisions

### Theme: dark by default, light kept

The app already defaults to dark and has a light/dark toggle. Both stay, because removing the
toggle would remove a feature. Dark is the brand look; light is a faithful counterpart.

Bright mint is unreadable on white (1.85:1), so the light theme uses a deeper mint.

| Token | Dark | Light | Notes |
|---|---|---|---|
| `--bg` | `#0E0E0E` | `#FFFFFF` | Page and calendar |
| `--bg-side` | `#0E0E0E` | `#FFFFFF` | Sidebar matches the page; a hairline separates them |
| `--bg-raised` | `#161616` | `#FFFFFF` | Dialogs, popovers |
| `--bg-hover` | `#1C1C1C` | `#F4F4F2` | |
| `--surface` (new) | `#181818` | `#F7F7F5` | Commitment blocks, segmented-control active state |
| `--border` | `#222222` | `#ECECEC` | Hairlines |
| `--text` | `#F2F2F2` | `#171717` | 17.2:1 / 17.9:1 |
| `--text-muted` | `#A3A3A3` | `#737373` | 7.7:1 / 4.7:1 |
| `--text-faint` | `#6E6E6E` | `#A3A3A3` | Decorative only (hour labels, hints) |
| `--accent` | `#5ED3A8` | `#0B7F58` | 10.4:1 on black / 5.0:1 on white |
| `--on-accent` (new) | `#06140F` | `#FFFFFF` | Text on mint fills |
| `--accent-soft` | `rgba(94,211,168,.15)` | `rgba(11,127,88,.10)` | Study blocks, selected states |
| `--today` | `transparent` | `transparent` | Today is marked by the circled date, not a column wash |
| `--danger` | `#F26666` | `#C9302C` | Conflicts (red) |
| `--warn` | `#E0A84F` | `#B7791F` | Tight squeezes (amber). No clash with mint, kept |
| `--ok` | = `--accent` | = `--accent` | Success messages share the brand mint |

The study map's own tokens (`--map-link`, `--map-label`, ...) get matching neutral values.

### Typography

- Figtree (variable font) for everything: wordmark, UI and calendar.
- Bundled via `@fontsource-variable/figtree` (one small dependency, Open Font License), imported
  once in `main.tsx`. Fallback stack: `ui-sans-serif, system-ui, sans-serif`.
- Base 14px / 1.5 as today. Page titles 700 with -0.025em tracking; brand wordmark 700, -0.035em.

### Brand

- `LogoIcon` in `icons.tsx` becomes the Cadence mark (48-unit grid: a 5.5-unit stroke wave plus
  a dot), colored with `--accent`.
- Sidebar brand and mobile bar read `praedus`.
- `<title>Praedus</title>`.
- `public/favicon.svg` becomes the Cadence mark in mint on a `#0E0E0E` rounded square.
- README: heading and intro renamed to Praedus. Technical content unchanged.
- Not renamed (see Constraints): package name, DB name, storage keys, PRODID, class names, and the
  feed helper's log line and user-agent.

### Component styling (Hairline)

- **Sidebar:** same sections and order. No panel color; one hairline on the right. Active nav item
  in `--text` at weight 600 with its icon in mint. Badges as today (red / amber).
- **Plan my study time:** solid mint fill, `--on-accent` text, 6px radius. It is the only
  solid-mint control.
- **Buttons:** primary = mint fill. Ghost = hairline border, no fill. Icon buttons as today.
  Radius 6px everywhere.
- **Calendar toolbar:** title 20px/700. Prev/next as quiet icon buttons. Month/Week/Agenda as a
  quiet segmented control whose active state uses `--surface` and weight 600.
- **Day headers:** weekday small and muted; the date number below it. Today: the weekday in mint
  and the number in a mint circle with `--on-accent` text.
- **Due row:** as today (dot + title + time), with conflict rows on a red tint.
- **Events:**
  - Commitments: `--surface` fill, 2px left edge in the course/type color.
  - Imported Canvas events: hairline outline with a 2px course-color edge.
  - Study blocks: `--accent-soft` fill, 2px mint edge, time in mint. Pinned and finished states
    keep their current markers.
  - Conflicts: red edge and outline as today.
- **Now line:** 1px mint with a small mint dot.
- **Dialogs and toasts:** `--bg-raised`, hairline border, softer shadow. Field focus ring in mint.
- **Study map:** recolored through tokens only. Accent-colored rings and labels become mint.
- **Empty state:** same copy and buttons, set in Figtree, with the Cadence mark above the headline.

### Course color defaults (needs your OK)

`db/colors.ts` assigns default colors to newly imported courses. Two of the eight (`#5fb88a` green
and `#56b6c2` teal) sit close to mint, so a course could look like a study block. Proposal:
replace those two with `#f08bb4` (pink) and `#e8c35a` (gold). This only affects courses imported
after the change. Existing courses keep their saved colors, and the color picker still allows
anything. This is the one edit outside the styling files. If you'd rather not touch it, skip it,
and the 2px-edge styling still keeps classes and study blocks distinguishable.

## Files expected to change

- `src/app/theme.css`: tokens and the rules described above (the bulk of the work)
- `src/app/icons.tsx`: `LogoIcon` becomes the Cadence mark
- `src/app/Sidebar.tsx`, `src/app/App.tsx`: brand text only
- `src/main.tsx`: font import
- `index.html`, `public/favicon.svg`, `README.md`
- `package.json` / `package-lock.json`: add `@fontsource-variable/figtree`
- `src/db/colors.ts`: only if the course color proposal is approved

## Verification (left to the plan, but must cover)

- `npm test`, `npm run typecheck`, `npm run lint` and `npm run build` pass before and after.
- Screenshots in both themes of: empty state, calendar week/month/agenda, assignments, study map,
  schedule, each dialog, and the mobile drawer at phone width.
- Hand-check that these still work: drag-to-create, drag/resize of commitments and study blocks,
  the scope prompt, Plan my study time, sample data import, re-sync and remove, course color
  picker, the theme toggle, and that an existing saved theme preference is respected.
- Contrast spot-check of the tokens above.

## Left to the builder

Exact spacing and padding values, shadow values, how the segmented control is reached through
FullCalendar's button group, and the order of CSS edits. All within the decisions above.

## Workflow

Implement on a branch (`rebrand/praedus`), not on `main`. Nothing is committed or pushed without
your say-so.
