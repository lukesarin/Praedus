import { useState } from 'react'
import { TYPE_COLORS } from '../commitments/colors'
import { describeCommitment } from '../commitments/format'
import { sortByNextUp } from '../commitments/order'
import type { Commitment } from '../commitments/types'
import type { Course, Feed } from '../db/db'
import { db } from '../db/db'
import { removeFeed, resyncFeed } from '../import/syncFeed'
import { CanvasCard } from '../canvas/CanvasCard'
import { isCanvasFeed } from '../canvas/canvasLink'
import { AlertIcon, CalendarIcon, GraphIcon, ListIcon, LogoIcon, MoonIcon, PlusIcon, RefreshIcon, SparkIcon, SunIcon, XIcon } from './icons'
import { relativeTime } from './relativeTime'
import type { Theme } from './useTheme'

export type View = 'calendar' | 'assignments' | 'map' | 'conflicts'

type Props = {
  view: View
  onView: (v: View) => void
  feeds: Feed[]
  courses: Course[]
  commitments: Commitment[]
  now: Date
  conflictCount: number
  warningCount: number
  onAddCommitment: () => void
  onEditCommitment: (id: string) => void
  onLoadTestShift: () => void
  onPlan: () => void
  planning: boolean
  theme: Theme
  onToggleTheme: () => void
  onImport: () => void
  open: boolean
  /** Feeds being synced by auto-sync or Sync now. */
  syncing: ReadonlySet<string>
  onSyncFeed: (feed: Feed) => void
  onConnectCanvas: () => void
  /** Assignment and course counts per feed id. */
  feedStats: Map<string, { assignments: number; courses: number }>
  /** The signed-in account, when accounts are on. */
  account?: { email: string; onLogOut: () => void }
}

export function Sidebar(props: Props) {
  const { view, onView, feeds, courses, commitments, now, conflictCount, warningCount, theme, onToggleTheme, onImport, open } = props
  const upcoming = sortByNextUp(commitments, now)
  const hasTestShift = commitments.some((c) => c.title === 'Work (test shift)')
  const courseColor = (c: Commitment) => courses.find((x) => x.id === c.courseId)?.color ?? TYPE_COLORS[c.type]
  const [syncing, setSyncing] = useState<string | null>(null)

  async function resync(feed: Feed) {
    setSyncing(feed.id)
    try {
      await resyncFeed(feed)
    } catch {
      // The error is saved on the feed and shown below it.
    } finally {
      setSyncing(null)
    }
  }

  async function disconnect(feed: Feed) {
    const ok = confirm(
      'Disconnect Canvas? Its assignments and their planned study blocks will be removed from Praedus. '
      + 'Your other calendars and commitments stay.',
    )
    if (ok) await removeFeed(feed.id)
  }

  async function remove(feed: Feed) {
    if (confirm(`Remove “${feed.label}” and everything imported from it?`)) await removeFeed(feed.id)
  }

  return (
    <aside className={`sidebar${open ? ' is-open' : ''}`} aria-label="Sidebar">
      <div className="brand">
        <LogoIcon />
        <span>praedus</span>
      </div>

      <nav className="nav">
        <button className={view === 'calendar' ? 'active' : ''} onClick={() => onView('calendar')}>
          <CalendarIcon /> Calendar
        </button>
        <button className={view === 'assignments' ? 'active' : ''} onClick={() => onView('assignments')}>
          <ListIcon /> Assignments
        </button>
        <button className={view === 'map' ? 'active' : ''} onClick={() => onView('map')}>
          <GraphIcon /> Study map
        </button>
        <button className={view === 'conflicts' ? 'active' : ''} onClick={() => onView('conflicts')}>
          <AlertIcon /> Schedule
          <span className="badges">
            {conflictCount > 0 && <span className="badge red" title={`${conflictCount} conflicts`}>{conflictCount}</span>}
            {warningCount > 0 && <span className="badge amber" title={`${warningCount} tight squeezes`}>{warningCount}</span>}
          </span>
        </button>
      </nav>

      <button className="plan-btn" onClick={props.onPlan} disabled={props.planning}>
        <SparkIcon /> {props.planning ? 'Planning…' : 'Plan my study time'}
      </button>

      <section className="side-section">
        <header>
          <h2>Commitments</h2>
          <button className="icon-btn" onClick={props.onAddCommitment} title="Add commitment" aria-label="Add commitment">
            <PlusIcon size={14} />
          </button>
        </header>
        {commitments.length === 0 && <p className="muted small">Classes, shifts, practice… Drag on the week view to add one.</p>}
        <ul>
          {upcoming.map(({ commitment: c, next }) => (
            <li key={c.id}>
              <button className={`commitment-item${next ? '' : ' is-finished'}`} onClick={() => props.onEditCommitment(c.id)}
                title={next ? undefined : 'Finished: no upcoming dates'}>
                <span className="swatch-static" style={{ background: courseColor(c) }} />
                <span className="commitment-text">
                  <span className="commitment-name">{c.title}</span>
                  <span className="muted small">{next ? describeCommitment(c) : `Finished · ${describeCommitment(c)}`}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        {!hasTestShift && (
          <button className="link-btn small" onClick={props.onLoadTestShift}>Load test work shift</button>
        )}
      </section>

      <section className="side-section">
        <header>
          <h2>Calendars</h2>
          <button className="icon-btn" onClick={onImport} title="Import calendar" aria-label="Import calendar">
            <PlusIcon size={14} />
          </button>
        </header>
        {!feeds.some(isCanvasFeed) && (
          <button className="connect-row" onClick={props.onConnectCanvas}>
            <PlusIcon size={14} /> Connect Canvas
          </button>
        )}
        <ul>
          {feeds.map((f) => isCanvasFeed(f) ? (
            <li key={f.id}>
              <CanvasCard feed={f} now={now.getTime()} syncing={props.syncing.has(f.id)}
                itemCount={props.feedStats.get(f.id)?.assignments ?? 0}
                courseCount={props.feedStats.get(f.id)?.courses ?? 0}
                onSyncNow={() => props.onSyncFeed(f)} onDisconnect={() => void disconnect(f)} />
            </li>
          ) : (
            <li key={f.id} className="feed">
              <div className="feed-row">
                <span className="feed-label" title={f.label}>{f.label}</span>
                {(f.url || f.id === 'sample') && (
                  <button className={`icon-btn${syncing === f.id ? ' spinning' : ''}`} onClick={() => resync(f)}
                    title="Sync now" aria-label={`Sync ${f.label}`} disabled={syncing === f.id}>
                    <RefreshIcon />
                  </button>
                )}
                <button className="icon-btn" onClick={() => remove(f)} title="Remove" aria-label={`Remove ${f.label}`}>
                  <XIcon />
                </button>
              </div>
              {f.lastError ? (
                <p className="feed-error small">{f.lastError}</p>
              ) : (
                f.lastSyncedAt && <p className="muted small">Synced {relativeTime(f.lastSyncedAt)}</p>
              )}
            </li>
          ))}
        </ul>
      </section>

      {courses.length > 0 && (
        <section className="side-section">
          <header><h2>Courses</h2></header>
          <ul>
            {courses.map((c) => (
              <li key={c.id} className="course">
                <label className="swatch" style={{ background: c.color }} title="Change color">
                  <input type="color" value={c.color} aria-label={`Color for ${c.name}`}
                    onChange={(e) => db.courses.update(c.id, { color: e.target.value })} />
                </label>
                <span title={c.name}>{c.name}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="side-footer">
        <button className="ghost-btn" onClick={onToggleTheme}>
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          {theme === 'dark' ? 'Light theme' : 'Dark theme'}
        </button>
        {props.account && (
          <div className="account-row">
            <span className="account-email" title={props.account.email}>{props.account.email}</span>
            <button className="link-btn" onClick={props.account.onLogOut}>Log out</button>
          </div>
        )}
      </footer>
    </aside>
  )
}
