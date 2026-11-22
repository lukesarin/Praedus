import { useEffect, useRef, useState } from 'react'
import { formatMinutes } from '../study/applyPlan'
import { dueInstant, estimateFor } from '../study/plan'
import { isPlannable } from '../study/testItems'
import type { StudyBlock } from '../study/types'
import type { CalendarItem, Course } from '../db/db'
import { db } from '../db/db'
import { formatDue } from '../calendar/dates'
import { ExternalIcon, XIcon } from './icons'

type Props = { item: CalendarItem; course?: Course; blocks: StudyBlock[]; onClose: () => void }

function formatRange(item: CalendarItem): string {
  if (item.kind === 'assignment' || !item.end || item.allDay) return formatDue(item)
  const end = new Date(item.end).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return `${formatDue(item)} – ${end}`
}

function EstimateField({ item }: { item: CalendarItem }) {
  const total = estimateFor(item)
  const [hours, setHours] = useState(String(Math.floor(total / 60)))
  const [mins, setMins] = useState(String(total % 60))
  const save = () => {
    const m = Math.max(0, Math.round((Number(hours) || 0) * 60 + (Number(mins) || 0)))
    if (m !== total) void db.items.update(item.id, { estimateMinutes: m })
  }
  return (
    <span className="estimate">
      <input type="number" min={0} max={99} aria-label="Estimated hours" value={hours}
        onChange={(e) => setHours(e.target.value)} onBlur={save} /> h
      <input type="number" min={0} max={59} step={15} aria-label="Estimated minutes" value={mins}
        onChange={(e) => setMins(e.target.value)} onBlur={save} /> min
    </span>
  )
}

export function ItemDetail({ item, course, blocks, onClose }: Props) {
  const [now] = useState(() => Date.now())
  const mine = blocks.filter((b) => b.itemId === item.id)
  const studied = mine.filter((b) => Date.parse(b.end) <= now).reduce((s, b) => s + (Date.parse(b.end) - Date.parse(b.start)) / 60000, 0)
  const planned = mine.filter((b) => Date.parse(b.end) > now).reduce((s, b) => s + (Date.parse(b.end) - Date.parse(b.start)) / 60000, 0)
  const needs = Math.max(0, estimateFor(item) - studied - planned)
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    ref.current?.showModal()
  }, [])

  return (
    <dialog ref={ref} className="modal detail" onClose={onClose}
      onClick={(e) => e.target === ref.current && ref.current?.close()}>
      <div className="modal-body">
        <header className="modal-header">
          <span className="kind">{item.kind === 'assignment' ? 'Assignment' : 'Event'}</span>
          <button className="icon-btn" onClick={() => ref.current?.close()} aria-label="Close"><XIcon /></button>
        </header>
        <h2>{item.title}</h2>
        <dl>
          {course && (<><dt>Course</dt><dd><span className="dot" style={{ background: course.color }} />{course.name}</dd></>)}
          <dt>{item.kind === 'assignment' ? 'Due' : 'When'}</dt>
          <dd>{formatRange(item)}</dd>
          {isPlannable(item) && (
            <>
              <dt>Est. time</dt>
              <dd><EstimateField key={item.estimateMinutes ?? 'default'} item={item} /></dd>
              <dt>Study</dt>
              <dd className="muted">
                {formatMinutes(planned)} planned · {formatMinutes(studied)} done
                {!item.done && needs > 0 && dueInstant(item) > now ? ` · needs ${formatMinutes(needs)} more` : ''}
              </dd>
            </>
          )}
        </dl>
        {item.removedFromSource && <p className="flag">This was removed from Canvas. Kept because you marked it done.</p>}
        {item.description && <p className="description">{item.description}</p>}
        <footer className="modal-footer">
          {item.kind === 'assignment' && (
            <label className="check">
              <input type="checkbox" checked={item.done}
                onChange={(e) => db.items.update(item.id, { done: e.target.checked })} />
              Done
            </label>
          )}
          {item.url && (
            <a className="ghost-btn" href={item.url} target="_blank" rel="noreferrer">
              Open in Canvas <ExternalIcon />
            </a>
          )}
        </footer>
      </div>
    </dialog>
  )
}
