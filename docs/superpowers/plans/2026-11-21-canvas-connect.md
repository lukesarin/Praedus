# Connect Canvas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A polished Connect Canvas flow, sidebar connection card and automatic sync, built on the existing calendar-feed import.

**Architecture:** A new `src/canvas/` folder holds pure helpers (link checks, friendly errors, sync timing), one hook and two components. Existing code is reused as-is: `syncFeedFromUrl`, `resyncFeed`, `removeFeed`, `importFeed`. Small edits wire it into `App.tsx`, `Sidebar.tsx` and `theme.css`.

**Tech Stack:** React 19, TypeScript, Dexie live queries, Vitest (node environment, `*.test.ts` only).

**Spec:** `docs/superpowers/specs/2026-11-21-canvas-connect-design.md`

## Global Constraints

- No changes to `src/db/`, `src/import/syncFeed.ts`, `src/import/ImportDialog.tsx`, `server/`, the calendar, the planner or the map.
- No schema changes and no new storage keys.
- Copy is exact as written in the spec (friendly errors, disconnect confirmation).
- The style uses only existing theme tokens (`--accent`, `--warn`, `--surface`, `--border`, ...). No Canvas logo.
- Branch `canvas/connect`. Commit when each task is green.

## Review Focus

1. **Two syncs at once** (auto-sync fires while a manual Sync now runs): the hook must skip a feed already syncing. Pinned by the `shouldSync` "already syncing" test (Task 2).
2. **Offline or server down**: auto-sync must not loop rapidly. It retries only on the 30-minute interval or the visibility rule. Pinned by the `shouldSync` tests for feeds with `lastError` (Task 2).
3. **Sample data and uploaded files** must never auto-sync (they can't, or must not, hit the network). Pinned in Task 2.
4. **`webcal://` links and surrounding whitespace** pasted from Canvas must be accepted. Pinned in Task 1.
5. **Disconnect deletes study blocks:** the confirmation copy must say so. Checked in the browser run (Task 4).

---

### Task 1: Link helpers and friendly errors

**Files:** Create `src/canvas/canvasLink.ts`, `src/canvas/canvasLink.test.ts`

**Interfaces (produces):**
- `normalizeCanvasLink(raw: string): string`: trims; `webcal://` becomes `https://`.
- `isCanvasFeedLink(raw: string): boolean`: after normalizing: `https:`, no credentials, path matches `/^\/feeds\/calendars\/[A-Za-z0-9_.-]+\.ics$/`.
- `isCanvasFeed(feed: Feed): boolean`: `!!feed.url && isCanvasFeedLink(feed.url)`.
- `friendlySyncError(message: string): string`

- [ ] **Step 1: Write failing tests.**
  - normalize: `'  webcal://s.instructure.com/feeds/calendars/user_ab.ics '` gives `'https://s.instructure.com/feeds/calendars/user_ab.ics'`.
  - isCanvasFeedLink: true for that https link and its webcal form. False for `http://…`, `https://s.edu/calendar`, `https://u:p@s.edu/feeds/calendars/user_a.ics` and `not a url`.
  - isCanvasFeed: false for `{ id: 'sample', label: 'Sample data' }` and for a file feed with no url.
  - friendlySyncError, using the server's real messages:
    - `"That isn't a Canvas calendar feed link."` and `"That address isn't allowed."` give `"That doesn't look like a Canvas calendar link. In Canvas, open Calendar → Calendar Feed and copy the link."`
    - `"Canvas answered with an error (404). Check that the link is current."` and `"Canvas didn't send back a calendar. Check that the link is current."` give `"This Canvas link stopped working. Paste a new one from Canvas."`
    - `"Couldn't reach the feed helper. Is \`npm run dev\` running?"` and `"Couldn't find the server s.edu."` give `"Couldn't reach Praedus's sync service. Check your connection; we'll try again shortly."`
    - anything else (e.g. `"Canvas took too long to answer."`) gives `"Canvas didn't respond. We'll try again shortly."`
- [ ] **Step 2:** `npx vitest run src/canvas/canvasLink.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3:** Implement. Match on message substrings (`isn't a Canvas calendar`, `isn't allowed`, `answered with an error`, `didn't send back a calendar`, `feed helper`, `Couldn't find the server`).
- [ ] **Step 4:** Run again. Expected: PASS. Then `npm test`, all pass. Commit.

### Task 2: Sync timing and the auto-sync hook

**Files:** Create `src/canvas/autoSync.ts`, `src/canvas/autoSync.test.ts`

**Interfaces:**
- Consumes `isCanvasFeed` (Task 1), `resyncFeed` (existing).
- Produces:
  - `type SyncReason = 'launch' | 'interval' | 'visible'`
  - `SYNC_INTERVAL_MS = 30 * 60_000`, `VISIBLE_MIN_GAP_MS = 5 * 60_000`
  - `shouldSync(feed: Feed, now: number, reason: SyncReason, syncing: ReadonlySet<string>): boolean`
  - `useAutoSync(feeds: Feed[] | undefined): { syncing: ReadonlySet<string>; syncNow: (feed: Feed) => Promise<void> }`

- [ ] **Step 1: Write failing tests for `shouldSync`:**
  - false for the sample feed and for a file feed (no url), for every reason
  - false when `syncing` has the feed's id
  - `launch`: true for any Canvas feed
  - `interval`: true for any Canvas feed (the timer itself sets the pace)
  - `visible`: false if `lastSyncedAt` is 2 min ago; true if 6 min ago; true if never synced
  - a feed with `lastError` set follows the same rules (it retries on the next trigger, not sooner)
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement `shouldSync`. Implement `useAutoSync`:
  - Keeps the syncing set in state (and a ref for the latest value).
  - `syncNow` adds the id, awaits `resyncFeed(feed)`, swallows the error (it's already saved on the feed by `syncFeedFromUrl`), then removes the id.
  - Effects: run `launch` once when `feeds` first arrives; a `setInterval(SYNC_INTERVAL_MS)` for `interval`; a `visibilitychange` listener for `visible` (only when `document.visibilityState === 'visible'`).
  - Feeds sync one after another, never in parallel. Clean up the timer and listener on unmount.
- [ ] **Step 4:** Run. Expected: PASS. `npm test` and `npm run typecheck` pass. Commit.

### Task 3: Connect dialog, sidebar card, wiring

**Files:**
- Create `src/canvas/ConnectCanvasDialog.tsx`, `src/canvas/CanvasCard.tsx`, `src/canvas/CanvasCard.test.ts`
- Modify `src/app/App.tsx`, `src/app/Sidebar.tsx`, `src/app/theme.css`

**Interfaces:**
- `ConnectCanvasDialog({ onClose }: { onClose: () => void })`
- `CanvasCard({ feed, itemCount, courseCount, syncing, now, onSyncNow, onDisconnect })`
- Sidebar gains props `syncing: ReadonlySet<string>`, `onSyncFeed: (f: Feed) => void`, `onConnectCanvas: () => void`. Its existing feed rows stay for non-Canvas feeds.

- [ ] **Step 1: Write failing tests** (`renderToStaticMarkup` with `createElement`, as in `Sidebar.test.ts`) for `CanvasCard`:
  - connected: has "Connected", "Synced", "12 assignments · 4 courses" (singular "1 assignment · 1 course" when it's 1), and buttons named "Sync now" and "Disconnect"
  - syncing: shows "Syncing…" and the Sync now button is disabled
  - error: shows "Needs attention" and the `friendlySyncError` text for the feed's `lastError`
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement `CanvasCard`. Status dot: `--accent` when connected, `--warn` for attention, pulsing only while syncing (respecting `prefers-reduced-motion`).
- [ ] **Step 4:** Implement `ConnectCanvasDialog`:
  - The same `<dialog>` pattern as `ImportDialog`.
  - Title "Connect Canvas". One line saying Praedus reads the calendar link only, it's saved in this browser, and it can't change anything in Canvas.
  - Numbered steps (a real sequence): "Open Canvas and go to Calendar", "Click Calendar Feed at the bottom right", "Copy the link and paste it below".
  - URL field, then the **Connect** button. While connecting, the button reads "Connecting…". If `isCanvasFeedLink` fails, show the invalid-link copy inline without calling the server.
  - On success: "Connected. N assignments from M courses." with a **Done** button. The counts come from the db for that feed id (`feedIdForUrl`).
  - On failure: `friendlySyncError`.
- [ ] **Step 5:** Wire it up:
  - `App.tsx`: `const { syncing, syncNow } = useAutoSync(feeds)`. Add a `connecting` state that renders `ConnectCanvasDialog`. The empty-state primary button text becomes "Connect Canvas" and opens it. Pass the new Sidebar props.
  - `Sidebar.tsx`: in the Calendars section, render `CanvasCard` for each Canvas feed. Disconnect runs `confirm()` with the spec's exact copy, then `removeFeed`. If there's no Canvas feed, show a "Connect Canvas" row button. Non-Canvas feeds render exactly as today.
- [ ] **Step 6:** Add CSS for `.canvas-card`, `.connect-steps` and `.connect-success` using existing tokens.
- [ ] **Step 7:** `npm test && npm run typecheck && npm run lint && npm run build`. Expected: all pass. Commit.

### Task 4: Browser check and README

**Files:** Modify `README.md` (the "Run it" paragraph and the "Known limits" re-sync line)

- [ ] **Step 1:** Run the app and drive it with the Chrome script. Screenshot both themes:
  - the empty state, then Connect Canvas opened
  - a malformed link (inline error, no request)
  - a well-formed but fake link (friendly error from the server)
  - Cancel/close
  - the sample data card (sample is not a Canvas feed, so its row is unchanged and the "Connect Canvas" row shows)
  - the "+" ImportDialog still opening
- [ ] **Step 2:** Update the README: "Connect Canvas" wording, and auto-sync "while Praedus is open: on launch, every 30 minutes, and when you return to the tab". Replace the "Re-syncing is manual" known limit with "Syncs only while Praedus is open."
- [ ] **Step 3:** All checks green. Commit. Hand the user a one-line test: connect with their real Canvas link.
