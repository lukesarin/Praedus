import { itemDateKey } from '../calendar/dates'
import type { CalendarItem, Course } from '../db/db'
import { formatMinutes } from '../study/applyPlan'
import { dueInstant } from '../study/plan'
import type { StudyBlock } from '../study/types'
import { courseCode, isLate } from './graph'
import { countdown, coverLine, plainDescription, weekHeading } from './panelText'
import { mondayOf, type Unit, type Week } from './units'

type Props = {
  course?: Course
  unit?: Unit
  weeks: Week[]
  blocks: StudyBlock[]
  /** Minutes of review time the test still needs (its coverage `short`). */
  short: number
  now: Date
  planning: boolean
  onPlan: () => void
  onToggleReviewed: (itemId: string, reviewed: boolean) => void
  onOpenItem: (itemId: string) => void
}

function testDate(item: CalendarItem): string {
  const d = new Date(dueInstant(item))
  const day = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  return item.allDay ? day : `${day}, ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
}

/** "Sun, Nov 22" and "7:00 – 8:30 PM" (the shared AM/PM said once). */
function blockWhen(b: StudyBlock): { day: string; time: string } {
  const start = new Date(b.start)
  const end = new Date(b.end)
  const t = (d: Date) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  const [s, e] = [t(start), t(end)]
  const suffix = /\s?[AP]M$/i.exec(s)?.[0]
  const sameHalf = suffix !== undefined && e.endsWith(suffix)
  return {
    day: start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
    time: `${sameHalf ? s.slice(0, -suffix.length) : s} – ${e}`,
  }
}

const shortDate = (key: string) =>
  new Date(key + 'T00:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })

function CheckIcon() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true">
      <path d="M2.5 6.2 5 8.6l4.5-5" />
    </svg>
  )
}

export function TestPrepPanel({ course, unit, weeks, blocks, short: missing, now, planning, onPlan, onToggleReviewed, onOpenItem }: Props) {
  if (!course) return <aside className="prep" aria-label="Test prep" />
  const code = courseCode(course.name)

  if (!unit) {
    return (
      <aside className="prep" aria-label="Test prep">
        <div className="prep-empty">
          <h2>No tests in {code}</h2>
          <p>Nothing in {course.name} is named like a test, so there's no test to prep for. Pick another class above.</p>
        </div>
        <p className="prep-note">Tests are found by name: “test”, “exam” or “midterm”.</p>
      </aside>
    )
  }

  const { test } = unit
  const nowMs = now.getTime()
  const upcoming = dueInstant(test) > nowMs
  const total = unit.items.length
  const reviewed = unit.items.filter((i) => i.reviewed).length
  const share = total ? reviewed / total : 0
  const short = upcoming ? missing : 0
  const mine = blocks
    .filter((b) => b.itemId === test.id && Date.parse(b.end) > nowMs)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
  const plannedMinutes = mine.reduce((s, b) => s + (Date.parse(b.end) - Date.parse(b.start)) / 60000, 0)

  const groups = weeks
    .filter((w) => unit.weeks.some((u) => u.start === w.start))
    .map((w) => ({ week: w, items: unit.items.filter((i) => mondayOf(itemDateKey(i)) === w.start) }))
    .filter((g) => g.items.length > 0)

  return (
    <aside className="prep" aria-label="Test prep">
      <header>
        <h2 className="prep-title">{test.title}</h2>
        <p className="prep-when">
          <b>{code}</b>, {testDate(test)}, <span className={upcoming ? 'soon' : ''}>{countdown(dueInstant(test), now)}</span>
        </p>
        <p className="prep-cover">{coverLine(unit)}</p>
      </header>

      {total > 0 && (
        <div className="prep-meter">
          <div className="prep-meter-row">
            <span><b>{reviewed}</b> of {total} reviewed</span>
            <span>{Math.round(share * 100)}%</span>
          </div>
          <div className="prep-bar" role="progressbar" aria-label="Reviewed" aria-valuemin={0} aria-valuemax={total} aria-valuenow={reviewed}>
            <i style={{ width: `${share * 100}%` }} />
          </div>
        </div>
      )}

      {!upcoming ? (
        <p className="prep-cover">This test is past, so there's nothing to plan.</p>
      ) : (
        (mine.length > 0 || short > 0) && (
          <div className="prep-plan">
            {mine.length > 0 && (
              <>
                <p className="prep-plan-head">Review time: {formatMinutes(plannedMinutes)} on your calendar</p>
                <ul className="prep-blocks">
                  {mine.map((b) => {
                    const w = blockWhen(b)
                    return <li key={b.id}>{w.day}<span>{w.time}</span></li>
                  })}
                </ul>
              </>
            )}
            {short > 0 && (
              <>
                <p className="prep-plan-need">{formatMinutes(short)} of review time still to plan</p>
                <button className="primary-btn prep-cta" onClick={onPlan} disabled={planning}>
                  {planning ? 'Planning…' : 'Plan review time'}
                </button>
              </>
            )}
          </div>
        )
      )}

      {unit.earliestKnown && (
        <p className="prep-note">
          Praedus has this class's work from {shortDate(unit.earliestKnown)} on. Earlier weeks came before you connected Canvas.
        </p>
      )}

      {total === 0 && <p className="prep-note">Nothing to review in these weeks.</p>}

      {groups.length > 0 && (
        <div className="prep-weeks">
          {groups.map((g) => (
            <section key={g.week.start} className="prep-week">
              <h3>{weekHeading(g.week)}</h3>
              <ul>
                {g.items.map((i) => {
                  const late = !i.done && isLate(i, now)
                  const desc = plainDescription(i.description)
                  return (
                    <li key={i.id} className={`prep-item${i.reviewed ? ' reviewed' : ''}`}>
                      <label className="prep-check">
                        <input type="checkbox" checked={Boolean(i.reviewed)} aria-label={`Reviewed ${i.title}`}
                          onChange={(e) => onToggleReviewed(i.id, e.target.checked)} />
                        <span className="prep-box"><CheckIcon /></span>
                      </label>
                      <div>
                        <button className="prep-item-title" onClick={() => onOpenItem(i.id)}>{i.title}</button>
                        {late && <span className="prep-flag">Not turned in</span>}
                        {desc && <span className="prep-desc">{desc}</span>}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <p className="prep-later">Study guide, coming with Premium.</p>
    </aside>
  )
}
