import { useState } from 'react'
import { formatDue } from '../calendar/dates'
import { db } from '../db/db'
import { normalizeMinGap, setMinGap } from '../db/settings'
import { formatMinutes } from '../study/applyPlan'
import type { Coverage } from '../study/coverage'
import { StudySettingsForm } from '../study/StudySettingsForm'
import type { StudySettings } from '../study/types'
import { CONFLICT_WINDOW_DAYS, type Conflict } from './conflicts'

type Props = {
  conflicts: Conflict[]
  minGap: number
  /** Upcoming assignments that don't have enough study time yet. */
  short: Coverage[]
  studySettings: StudySettings
  /** First day of classes (YYYY-MM-DD), or null when not set. */
  termStart: string | null
  planning: boolean
  onPlan: () => void
  onSelectItem: (itemId: string) => void
  onJump: (isoOrDate: string) => void
}

function when(iso: string): string {
  return formatDue({ start: iso, allDay: false })
}

function describe(c: Conflict): { title: string; detail: string } {
  switch (c.kind) {
    case 'overlap':
      return { title: `${c.a.title} overlaps ${c.b.title}`, detail: when(c.b.start) }
    case 'deadline':
      return { title: `${c.item.title} is due during ${c.occurrence.title}`, detail: `Due ${when(c.item.start)}` }
    case 'tight':
      return {
        title: `${c.a.title} → ${c.b.title}`,
        detail: `${c.gapMinutes === 0 ? 'No time' : `Only ${c.gapMinutes} min`} between them · ${when(c.a.end)}`,
      }
  }
}

export function ConflictsView({ conflicts, minGap, short, studySettings, termStart, planning, onPlan, onSelectItem, onJump }: Props) {
  const red = conflicts.filter((c) => c.kind !== 'tight')
  const amber = conflicts.filter((c) => c.kind === 'tight')

  const row = (c: Conflict) => {
    const { title, detail } = describe(c)
    return (
      <li key={c.id}>
        <button className="conflict-row" onClick={() => onJump(c.at)}>
          <span className="conflict-title">{title}</span>
          <span className="conflict-detail">{detail}</span>
        </button>
      </li>
    )
  }

  return (
    <div className="conflicts-page">
      <header className="schedule-header">
        <h1 className="page-title">Schedule</h1>
        <button className="primary-btn" onClick={onPlan} disabled={planning}>
          {planning ? 'Planning…' : 'Plan my study time'}
        </button>
      </header>
      <p className="muted small">Checking your commitments and deadlines for the next {CONFLICT_WINDOW_DAYS / 7} weeks.</p>

      <section className="group conflict-group red">
        <h2>Conflicts <span className="count">{red.length}</span></h2>
        {red.length === 0 ? <p className="muted">Nothing overlaps. Nice.</p> : <ul>{red.map(row)}</ul>}
      </section>

      <section className="group conflict-group amber">
        <h2>Tight squeezes <span className="count">{amber.length}</span></h2>
        {minGap === 0 ? (
          <p className="muted">Back-to-back warnings are off.</p>
        ) : amber.length === 0 ? (
          <p className="muted">No back-to-back commitments.</p>
        ) : (
          <ul>{amber.map(row)}</ul>
        )}
      </section>

      <section className="group conflict-group amber">
        <h2>Needs more study time <span className="count">{short.length}</span></h2>
        {short.length === 0 ? (
          <p className="muted">Every upcoming assignment has enough study time planned.</p>
        ) : (
          <ul>
            {short.map((c) => (
              <li key={c.item.id}>
                <button className="conflict-row" onClick={() => onSelectItem(c.item.id)}>
                  <span className="conflict-title">{c.item.title}</span>
                  <span className="conflict-detail">
                    Needs {formatMinutes(c.short)} more · {formatMinutes(c.planned + c.studied)} of {formatMinutes(c.estimate)} planned
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <GapSetting key={minGap} minGap={minGap} />
      <StudySettingsForm key={JSON.stringify(studySettings)} settings={studySettings} termStart={termStart} />
    </div>
  )
}

/** Remounted (via key) whenever the saved value changes, so the input starts in sync. */
function GapSetting({ minGap }: { minGap: number }) {
  const [value, setValue] = useState(String(minGap))
  const save = () => void setMinGap(db, normalizeMinGap(value))
  return (
    <form className="gap-setting" onSubmit={(e) => { e.preventDefault(); save() }}>
      <label>
        Warn me when commitments are less than
        <input type="number" min={0} max={240} value={value} aria-label="Minutes between commitments"
          onChange={(e) => setValue(e.target.value)} onBlur={save} />
        minutes apart.
      </label>
      <span className="muted small">Set to 0 to turn these warnings off.</span>
    </form>
  )
}
