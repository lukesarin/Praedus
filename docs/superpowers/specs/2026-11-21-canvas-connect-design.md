# Connect Canvas: design

Status: awaiting approval · Date: 2026-11-21

## Intent

Make bringing in Canvas feel like a native, polished part of Praedus that **every student at every
school** can use, with no school approval, and keep it in sync automatically.

## Why this approach

The Canvas REST API (tokens or OAuth) was considered and rejected for now:

- Canvas's API policy forbids asking other users to make a personal access token and paste it into
  an app: "Applications in use by multiple users MUST use OAuth" (canvas.instructure.com/doc/api/file.oauth.html).
- OAuth developer keys are issued per institution by its Canvas admin, or globally by Instructure
  and then enabled by each school (file.developer_keys.html). Both depend on schools.
- The user's rule: if a school can shut it down, it doesn't ship.

The Canvas **calendar feed link** (Calendar → Calendar Feed) is per-student and needs no approval.
Praedus already imports it. *Unverified:* we did not find official documentation stating whether an
institution can disable the feed. The articles we tried have moved. Treat this as an open risk, not
a fact.

Trade-off accepted: no grades, no "submitted" status. Students keep marking work done themselves.

## Goals

1. A **Connect Canvas** flow: three short steps to find the link, paste, Connect. Praedus checks the
   link's shape before contacting the server and shows a clear result ("Connected. 12 assignments
   from 4 courses.").
2. A **Canvas connection card** in the sidebar: status, last sync, item and course counts,
   **Sync now** and **Disconnect**.
3. **Automatic sync** while Praedus is open: on launch, every 30 minutes, and when the tab becomes
   visible again if the last sync is more than 5 minutes old.
4. **Plain-language problems** in place of raw errors, shown on the card and not as repeated popups.

## Non-goals

Grades, submission status, OAuth, personal tokens, syncing while the app is closed, server changes,
and database schema changes.

## Anti-goals

- Automatic sync ever overwrites a student's done marks, edits, estimates, course colors or study
  blocks. (The existing `importFeed` merge already guarantees this. Auto-sync must only call it.)
- Auto-sync spams toasts or errors, or runs two syncs of one feed at once.
- Imitating Canvas's branding. We say "Canvas" in plain text and use no Canvas logo.

## Design

### Where it lives

New folder `src/canvas/`, so the feature is easy to find and remove:

- `canvasLink.ts`: pure helpers. `normalizeCanvasLink(raw)` (trims; `webcal://` becomes `https://`),
  `isCanvasFeedLink(url)` (same shape the server accepts: `https`, path `/feeds/calendars/<token>.ics`),
  `isCanvasFeed(feed)`, and `friendlySyncError(message)`, which maps known failures to plain
  language.
- `autoSync.ts`: pure `shouldSync(feed, now, reason)` for the timing rules, and `useAutoSync(feeds)`,
  a React hook that runs syncs one at a time through the existing `resyncFeed`.
- `ConnectCanvasDialog.tsx`: the connect flow.
- `CanvasCard.tsx`: the sidebar card.

### What existing files change (small)

- `App.tsx`: calls `useAutoSync(feeds)`. The empty-state primary button becomes **Connect Canvas**
  and opens the new dialog. It also renders the dialog.
- `Sidebar.tsx`: Canvas feeds render as `CanvasCard`. With no Canvas feed, the Calendars section
  shows a **Connect Canvas** row. Uploaded files and sample data keep today's row exactly.
- `ImportDialog.tsx`: unchanged. It still handles links and `.ics` uploads from the "+" button.
- `theme.css`: styles for the dialog and card, using existing tokens only.

No changes to `db/`, `importFeed`, `syncFeed` logic, `server/`, the calendar, the planner or the map.

### Behavior details

- **Connect**: calls the existing `syncFeedFromUrl`. Connecting the same link again just re-syncs
  it, as today.
- **Disconnect**: uses the existing `removeFeed`, behind a confirmation that says plainly what
  happens: "Disconnect Canvas? Its assignments and their planned study blocks will be removed from
  Praedus. Your other calendars and commitments stay."
- **Card states**: *Connected* (mint dot, "Synced 4 min ago"), *Syncing…*, *Needs attention* (amber
  dot plus the friendly error, and Sync now stays available).
- **Friendly errors**: an invalid link → "That doesn't look like a Canvas calendar link. In Canvas,
  open Calendar → Calendar Feed and copy the link." The server can't be reached → "Couldn't reach
  Praedus's sync service. Check your connection; we'll try again shortly." Canvas says the link is
  gone → "This Canvas link stopped working. Paste a new one from Canvas." Anything else → "Canvas
  didn't respond. We'll try again shortly."

## Reversibility

Built on its own branch (`canvas/connect`) on top of the committed rebrand. No schema or server
changes, so nothing in saved data needs undoing. The feature is a folder plus small edits to four
files, so dropping the branch removes it completely.

## Verification

- Unit tests (TDD) for `normalizeCanvasLink`, `isCanvasFeedLink`, `friendlySyncError` and
  `shouldSync`, including launch, interval, visibility, "already syncing", sample and uploaded
  feeds never auto-syncing, and a feed with an error still retrying.
- The full suite, typecheck, lint and build stay green.
- Browser run (Chrome script, as for the rebrand): connect with a malformed link, connect with a
  well-formed link the server can't fetch (shows the friendly error), the card states with sample
  data, disconnect and cancel, and see that the existing "+" import still works.
- A real successful connect needs a real Canvas link. The server deliberately refuses local test
  servers, so the user does the final check with their own Canvas link.
