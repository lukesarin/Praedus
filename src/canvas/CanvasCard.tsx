import type { Feed } from '../db/db'
import { relativeTime } from '../app/relativeTime'
import { friendlySyncError } from './canvasLink'

type Props = {
  feed: Feed
  itemCount: number
  courseCount: number
  syncing: boolean
  now: number
  onSyncNow: () => void
  onDisconnect: () => void
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

function hostOf(url?: string): string | undefined {
  try {
    return url ? new URL(url).hostname : undefined
  } catch {
    return undefined
  }
}

/** The sidebar card for a connected Canvas account: status, last sync, and the two actions. */
export function CanvasCard({ feed, itemCount, courseCount, syncing, now, onSyncNow, onDisconnect }: Props) {
  const state = syncing ? 'syncing' : feed.lastError ? 'attention' : 'connected'
  const label = { syncing: 'Syncing…', attention: 'Needs attention', connected: 'Connected' }[state]
  return (
    <div className={`canvas-card is-${state}`}>
      <div className="canvas-card-head">
        <span className="status-dot" aria-hidden="true" />
        <span className="canvas-card-title">Canvas</span>
        <span className="canvas-card-state">{label}</span>
      </div>
      {hostOf(feed.url) && <p className="canvas-card-host">{hostOf(feed.url)}</p>}
      <p className="canvas-card-meta">
        {feed.lastSyncedAt ? `Synced ${relativeTime(feed.lastSyncedAt, now)}` : 'Not synced yet'}
        <br />
        {`${plural(itemCount, 'assignment')} · ${plural(courseCount, 'course')}`}
      </p>
      {state === 'attention' && feed.lastError && (
        <p className="canvas-card-error" role="status">{friendlySyncError(feed.lastError)}</p>
      )}
      <div className="canvas-card-actions">
        <button className="ghost-btn" onClick={onSyncNow} disabled={syncing}>Sync now</button>
        <button className="link-btn" onClick={onDisconnect} disabled={syncing}>Disconnect</button>
      </div>
    </div>
  )
}
