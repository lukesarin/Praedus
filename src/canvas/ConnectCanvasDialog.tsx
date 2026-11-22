import { useEffect, useRef, useState } from 'react'
import { LogoIcon, XIcon } from '../app/icons'
import { db } from '../db/db'
import { feedIdForUrl, syncFeedFromUrl } from '../import/syncFeed'
import { friendlySyncError, INVALID_LINK_MESSAGE, isCanvasFeedLink, normalizeCanvasLink } from './canvasLink'

type Props = { onClose: () => void }
type Connected = { assignments: number; courses: number }

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** Connect Canvas through the student's own calendar link: works at any school, no approval needed. */
export function ConnectCanvasDialog({ onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState<Connected | null>(null)

  useEffect(() => {
    ref.current?.showModal()
  }, [])

  async function connect() {
    setError(null)
    if (!isCanvasFeedLink(url)) return setError(INVALID_LINK_MESSAGE)
    setBusy(true)
    try {
      const link = normalizeCanvasLink(url)
      await syncFeedFromUrl(link)
      const items = await db.items.where('feedId').equals(feedIdForUrl(link)).toArray()
      const assignments = items.filter((i) => i.kind === 'assignment')
      setConnected({ assignments: assignments.length, courses: new Set(items.map((i) => i.courseId).filter(Boolean)).size })
    } catch (err) {
      setError(friendlySyncError(err instanceof Error ? err.message : String(err)))
    } finally {
      setBusy(false)
    }
  }

  return (
    <dialog ref={ref} className="modal connect-canvas" onClose={onClose} aria-labelledby="connect-canvas-title"
      onClick={(e) => e.target === ref.current && ref.current?.close()}>
      <div className="modal-body">
        <header className="modal-header">
          <h2 id="connect-canvas-title">Connect Canvas</h2>
          <button className="icon-btn" onClick={() => ref.current?.close()} aria-label="Close"><XIcon /></button>
        </header>

        {connected ? (
          <div className="connect-success" role="status">
            <span className="connect-success-mark"><LogoIcon size={32} /></span>
            <p className="connect-success-title">Connected</p>
            <p className="muted">
              {plural(connected.assignments, 'assignment')} from {plural(connected.courses, 'course')}.
              Praedus keeps them in sync while it's open.
            </p>
            <button className="primary-btn" onClick={() => ref.current?.close()} autoFocus>Done</button>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); void connect() }} noValidate>
            <p className="connect-lede">
              Praedus reads your Canvas calendar link to bring in your assignments and due dates. The link is
              saved only in this browser, and Praedus can't change anything in Canvas.
            </p>
            <ol className="connect-steps">
              <li>Open Canvas and go to <strong>Calendar</strong></li>
              <li>Click <strong>Calendar Feed</strong> at the bottom right</li>
              <li>Copy the link and paste it below</li>
            </ol>
            <label className="field">
              <span>Canvas calendar link</span>
              <input type="url" placeholder="https://yourschool.instructure.com/feeds/calendars/user_….ics"
                value={url} onChange={(e) => { setUrl(e.target.value); setError(null) }}
                autoFocus spellCheck={false} aria-invalid={!!error} aria-describedby={error ? 'connect-error' : undefined} />
            </label>
            {error && <p id="connect-error" className="alert error" role="alert">{error}</p>}
            <div className="connect-actions">
              <button className="primary-btn" disabled={busy || !url.trim()}>{busy ? 'Connecting…' : 'Connect'}</button>
            </div>
          </form>
        )}
      </div>
    </dialog>
  )
}
