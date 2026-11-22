# Praedus Rebrand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle StudyBlocks as Praedus (Cadence mark, Figtree, mint on black) without changing any behavior.

**Architecture:** A token restyle. New values for the existing CSS variables in `src/app/theme.css`, rule-level changes for the look (today circle, events, buttons, nav), and a few small markup changes (logo, brand text, title, favicon). No logic files change except the two default course colors in `src/db/colors.ts`.

**Tech Stack:** React 19, TypeScript, Vite, FullCalendar 6, Vitest + Testing Library, `@fontsource-variable/figtree`.

**Spec:** `docs/superpowers/specs/2026-11-21-praedus-rebrand-design.md`

## Global Constraints

- Do not change: the IndexedDB name `studyblocks`, the localStorage keys `studyblocks.theme` / `studyblocks.mapFilters`, the sample `PRODID`, the `StudyBlocksDB` class name, `sb-*` class names, or anything in `server/`.
- No edits to `commitments/`, `study/`, `import/`, `db/` or `server/`, except `src/db/colors.ts` (Task 4).
- Wordmark text is lowercase `praedus`. The page title is `Praedus`.
- Dark tokens: `--bg #0E0E0E`, `--bg-side #0E0E0E`, `--bg-raised #161616`, `--bg-hover #1C1C1C`, `--surface #181818`, `--border #222222`, `--text #F2F2F2`, `--text-muted #A3A3A3`, `--text-faint #6E6E6E`, `--accent #5ED3A8`, `--on-accent #06140F`, `--accent-soft rgba(94,211,168,.15)`, `--today transparent`, `--danger #F26666`, `--warn #E0A84F`, `--ok var(--accent)`.
- Light tokens: `--bg #FFFFFF`, `--bg-side #FFFFFF`, `--bg-raised #FFFFFF`, `--bg-hover #F4F4F2`, `--surface #F7F7F5`, `--border #ECECEC`, `--text #171717`, `--text-muted #737373`, `--text-faint #A3A3A3`, `--accent #0B7F58`, `--on-accent #FFFFFF`, `--accent-soft rgba(11,127,88,.10)`, `--today transparent`, `--danger #C9302C`, `--warn #B7791F`, `--ok var(--accent)`.
- Font: Figtree via `@fontsource-variable/figtree`, fallback `ui-sans-serif, system-ui, sans-serif`. Radius 6px on buttons.
- Work on branch `rebrand/praedus`. Do not commit; the user commits when they say so.

## Review Focus

1. **Existing saved theme:** a user with `studyblocks.theme = 'light'` still opens in light. Covered by not touching `useTheme.ts`; checked by hand in Task 5.
2. **Drag and resize hit areas:** event padding and borders change the targets for drag-to-create and resize. Checked by hand in Task 5 (no browser automation is installed).
3. **Muted text on light:** `#737373` on white is 4.7:1, close to the 4.5 floor. Pinned by the contrast test in Task 1.
4. **Conflict vs. accent:** red conflicts and amber warnings must stay distinct from mint. Pinned by the contrast/distinctness test in Task 1.
5. **Narrow screens:** the mobile bar and drawer still work with the new brand text and font. Screenshot at 390px in Task 5.

---

### Task 0: Branch and baseline

- [ ] **Step 1:** `git checkout -b rebrand/praedus`
- [ ] **Step 2:** `npm install`. Expected: completes without errors.
- [ ] **Step 3:** `npm test && npm run typecheck && npm run lint && npm run build`. Expected: all pass. Record any pre-existing failure before changing anything.

### Task 1: Font and color tokens

**Files:**
- Modify: `package.json`, `package-lock.json` (add `@fontsource-variable/figtree`)
- Modify: `src/main.tsx` (font import)
- Modify: `src/app/theme.css` (token blocks at the top, `body` font, header comment)
- Test: `src/app/theme.test.ts` (new)

**Interfaces:**
- Produces: CSS variables `--surface` and `--on-accent` (new), used by Task 3.

- [ ] **Step 1: Write the failing test** `src/app/theme.test.ts`. Read `theme.css` with `fs`, parse the dark block (`:root,\n:root[data-theme='dark']`) and the light block (`:root[data-theme='light']`) into maps of hex tokens, and compute WCAG contrast. Assertions:
  - dark `--accent` is `#5ed3a8` and light `--accent` is `#0b7f58`
  - for each theme: contrast(`--text`, `--bg`) ≥ 4.5, contrast(`--text-muted`, `--bg`) ≥ 4.5, contrast(`--accent`, `--bg`) ≥ 4.5, contrast(`--on-accent`, `--accent`) ≥ 4.5, contrast(`--danger`, `--bg`) ≥ 3
  - for each theme: `--danger` and `--warn` differ from `--accent` in hue by at least 60°
- [ ] **Step 2:** `npx vitest run src/app/theme.test.ts`. Expected: FAIL (accent is still violet).
- [ ] **Step 3:** `npm install @fontsource-variable/figtree`. Add `import '@fontsource-variable/figtree'` in `src/main.tsx` before `App` is imported. Replace both token blocks with the Global Constraints values (keep `--shadow` and the soft `-soft` tints for danger/ok, recolored to match). Set the `body` font to `'Figtree Variable', ui-sans-serif, system-ui, sans-serif`. Change the header comment to Praedus.
- [ ] **Step 4:** `npx vitest run src/app/theme.test.ts`. Expected: PASS. Then `npm test`. Expected: all pass.

### Task 2: Brand mark and name

**Files:**
- Modify: `src/app/icons.tsx` (`LogoIcon`)
- Modify: `src/app/Sidebar.tsx:61`, `src/app/App.tsx:203` (brand text)
- Modify: `index.html` (title), `public/favicon.svg`
- Test: `src/app/Sidebar.test.tsx` (new)

**Interfaces:**
- Produces: `LogoIcon({ size?: number })` keeps its signature. It draws the Cadence mark on a 48-unit viewBox: path `M6.5 24C6.5 13 19.5 13 19.5 24S32.5 35 32.5 24` (stroke 5.5, round caps, `currentColor`) plus a circle at (40.5, 24) with r 3.9.

- [ ] **Step 1: Write the failing test** `src/app/Sidebar.test.tsx`. Render `<Sidebar>` with empty feeds/courses/commitments, `view="calendar"`, `theme="dark"` and no-op handlers. Assert `getByText('praedus')` exists and `queryByText('StudyBlocks')` is null.
- [ ] **Step 2:** `npx vitest run src/app/Sidebar.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Replace `LogoIcon` with the Cadence mark. Change the brand text in `Sidebar.tsx` and the mobile bar in `App.tsx` to `praedus`. Set `<title>Praedus</title>`. Write `public/favicon.svg` as a 48×48 rounded square (`rx="11"`, fill `#0E0E0E`) holding the Cadence mark in `#5ED3A8`, scaled to about 60% and centered.
- [ ] **Step 4:** `npx vitest run src/app/Sidebar.test.tsx`. Expected: PASS. `npm test`. Expected: all pass.

### Task 3: Hairline component styling

**Files:**
- Modify: `src/app/theme.css` (rule sections: layout, buttons, empty state, calendar, assignment list, dialogs, mobile, study map)

**Interfaces:**
- Consumes: `--surface`, `--on-accent` from Task 1.

The spec's "Component styling (Hairline)" section is the source of truth for each element. Key decisions, restated so they can be checked:
- `.sidebar`: background `var(--bg-side)`, 1px right border, no other panel styling. `.nav button.active`: `color: var(--text)`, weight 600, `background: transparent`, icon `color: var(--accent)`.
- `.plan-btn` and `.primary-btn`: background `var(--accent)`, color `var(--on-accent)`, weight 700, radius 6px. `.ghost-btn`: 1px `var(--border)` border, transparent background.
- FullCalendar toolbar: title 20px/700, -0.025em. Button group as a quiet segmented control: transparent buttons, active `background: var(--surface)`, weight 600, no border.
- Day headers (`.fc-col-header-cell` in timegrid): weekday small/muted, date number below. Today (`.fc-day-today`): weekday in `var(--accent)`, number in a 30px circle with `background: var(--accent)`, `color: var(--on-accent)`. FullCalendar renders the header as one text node ("Tue 24"), so split it with `dayHeaderContent` in `CalendarView.tsx` **only if CSS can't reach it**. That is markup, not logic: keep the same date formatting and return two spans.
- Commitment events (`.sb-commitment`): `background: var(--surface)`, `box-shadow: inset 2px 0 0 <event color>`, text `var(--text)`. Study blocks (`.sb-study`): `background: var(--accent-soft)`, `inset 2px 0 0 var(--accent)`, time in `var(--accent)`. Canvas events: transparent with a hairline outline plus a 2px course-color edge. Conflicts keep their red treatment.
- `--fc-now-indicator-color: var(--accent)`.
- `.modal`: `background: var(--bg-raised)`, 1px `var(--border)` border. Inputs get a `var(--accent)` focus ring.
- `.empty`: show `LogoIcon` (size 40, `color: var(--accent)`) above the headline. That is one JSX line in `App.tsx`, inside the existing `.empty` block.

- [ ] **Step 1:** Apply the rules above in `theme.css`, section by section.
- [ ] **Step 2:** `npm run build && npm test && npm run typecheck && npm run lint`. Expected: all pass.
- [ ] **Step 3:** Start `npm run dev`. Load sample data and take headless Chrome screenshots of the week view in both themes. Compare them against the "Mint on black" option in `design-exploration/index.html`, then fix differences and repeat until they match in spirit.

### Task 4: Course color defaults

**Files:**
- Modify: `src/db/colors.ts`
- Test: `src/db/colors.test.ts` (new)

- [ ] **Step 1: Write the failing test.** `COURSE_COLORS` has length 8, contains `#f08bb4` and `#e8c35a`, and does not contain `#5fb88a` or `#56b6c2`. `nextCourseColor(0)` is still `COURSE_COLORS[0]`.
- [ ] **Step 2:** `npx vitest run src/db/colors.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Replace `#5fb88a` with `#f08bb4` (pink) and `#56b6c2` with `#e8c35a` (gold), in the same positions. Update their comments.
- [ ] **Step 4:** `npm test`. Expected: all pass.

### Task 5: README and full verification

**Files:**
- Modify: `README.md` (heading and intro paragraph only)

- [ ] **Step 1:** Rename the README heading to "Praedus" and adjust the intro sentence. Leave technical sections as they are.
- [ ] **Step 2:** `npm test && npm run typecheck && npm run lint && npm run build`. Expected: all pass.
- [ ] **Step 3:** Screenshots in both themes: empty state, calendar week/month/agenda, assignments, study map, schedule, item detail dialog, commitment form, import dialog, and the mobile drawer at 390px. Fix visual defects.
- [ ] **Step 4:** Report which interactions were checked automatically, and list the ones the user must try by hand (drag-to-create, drag/resize, scope prompt, theme toggle with an existing saved preference).
