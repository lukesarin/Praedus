import { useState, type FormEvent } from 'react'
import { itemDateKey } from '../calendar/dates'
import type { CalendarItem, Course, Note } from '../db/db'
import { NotesDrop, useFilePicker } from '../notes/NotesDrop'
import { notesSummary, weekLabel, type NoteInput } from '../notes/notes'
import { formatMinutes } from '../study/applyPlan'
import { dueInstant } from '../study/plan'
import type { StudyBlock } from '../study/types'
import { courseCode, isLate } from './donut'
import { countdown, plainDescription, studySetTopics, weekHeading, type StudySetTopic } from './panelText'
import { mondayOf, type Unit, type Week } from './units'

export type PanelTest = { item: CalendarItem; cover: string }

type Props = {
  course?: Course
  /** The class's tests on the map, in date order, each with its cover line. */
  tests: PanelTest[]
  unit?: Unit
  weeks: Week[]
  blocks: StudyBlock[]
  /** Minutes of review time the test still needs (its coverage `short`). */
  short: number
  now: Date
  planning: boolean
  onPlan: () => void
  /** `undefined` unpicks the test. */
  onPickTest: (testId: string | undefined) => void
  onToggleReviewed: (itemId: string, reviewed: boolean) => void
  onOpenItem: (itemId: string) => void
  /** The class's notes, all weeks. */
  notes: Note[]
  onFiles: (inputs: NoteInput[]) => void
  /** Tests of this class that already have a study set. */
  studySetIds: string[]
  /** Makes a new set from these topics (replacing any old one) and opens it. */
  onCreateSet: (topics: StudySetTopic[]) => void
  onOpenSet: (testId: string) => void
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

function SparkIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 1.8 9.4 6.6 14.2 8 9.4 9.4 8 14.2 6.6 9.4 1.8 8 6.6 6.6Z" />
    </svg>
  )
}

/** Picks topics for a study set. Nothing is saved yet: saving comes with the AI. */
type StepProps = {
  test: CalendarItem
  unit: Unit
  weeks: Week[]
  notes: Note[]
  onFiles: (inputs: NoteInput[]) => void
  onCreate: (topics: StudySetTopic[]) => void
  onBack: () => void
}

function StudySetStep({ test, unit, weeks, notes, onFiles, onCreate, onBack }: StepProps) {
  const [topics, setTopics] = useState<StudySetTopic[]>(() => studySetTopics(unit))
  const [draft, setDraft] = useState('')
  const picker = useFilePicker(onFiles)
  const covered = new Set(unit.weeks.map((w) => w.start))
  const used = notes.filter((x) => covered.has(x.week))
  const span = unit.weeks.length
    ? `${weekLabel(unit.weeks[0].start, weeks)}–${weekLabel(unit.weeks[unit.weeks.length - 1].start, weeks)}`
    : ''
  const n = unit.items.length
  const add = (e: FormEvent) => {
    e.preventDefault()
    const title = draft.trim()
    if (!title) return
    setTopics((t) => [...t, { id: `own-${Date.now()}-${t.length}`, title, hint: '' }])
    setDraft('')
  }
  return (
    <section className="prep-sheet" aria-label="Study set">
      <h3>Study set for {test.title}</h3>
      <p>
        These topics come from the {n === 1 ? 'assignment' : `${n} assignments`} in the weeks this test covers. Remove anything
        that won't be on the test, or add your own.
      </p>
      {topics.length > 0 && (
        <ul className="prep-topics">
          {topics.map((t) => (
            <li key={t.id} className="prep-topic" title={t.hint || undefined}>
              <span>{t.title}</span>
              <button aria-label={`Remove ${t.title}`} onClick={() => setTopics((all) => all.filter((x) => x.id !== t.id))}>×</button>
            </li>
          ))}
        </ul>
      )}
      <div className="prep-notes">
        <p>
          {used.length
            ? `Also uses your ${used.length === 1 ? 'note' : `${used.length} notes`} from weeks ${span}:`
            : 'No notes for these weeks yet. Cards will come from the topics alone.'}
        </p>
        {used.length > 0 && (
          <ul className="note-chips">
            {used.map((x) => <li key={x.id} className="note-chip" title={x.name}>{x.name}</li>)}
          </ul>
        )}
        <button type="button" className="prep-link" onClick={picker.open}>+ Add notes for this test</button>
        {picker.input}
      </div>
      <form className="prep-add" onSubmit={add}>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add a topic" aria-label="Add a topic" />
        <button type="submit">Add</button>
      </form>
      <button className="primary-btn prep-cta prep-spark" disabled={topics.length === 0} onClick={() => onCreate(topics)}>
        <SparkIcon />Create study set
      </button>
      <button className="prep-ghost" onClick={onBack}>Back</button>
    </section>
  )
}

export function TestPrepPanel(props: Props) {
  const { course, tests, unit, weeks, blocks, short: missing, now, planning, onPlan, onPickTest, onToggleReviewed, onOpenItem, notes, onFiles } = props
  // The study set step is open for this test id; picking another test closes it.
  const [sheetFor, setSheetFor] = useState<string>()
  if (!course) return <aside className="prep" aria-label="Upcoming tests" />
  const code = courseCode(course.name)
  const nowMs = now.getTime()
  const upcomingTests = tests.filter((t) => dueInstant(t.item) > nowMs)
  const pastTests = tests.filter((t) => dueInstant(t.item) <= nowMs).reverse()

  const row = (t: PanelTest) => {
    const due = dueInstant(t.item)
    const past = due <= nowMs
    const on = unit?.test.id === t.item.id
    return (
      <button key={t.item.id} className={`prep-test${past ? ' past' : ''}${on ? ' on' : ''}`} aria-pressed={on}
        onClick={() => onPickTest(on ? undefined : t.item.id)}>
        <b>{t.item.title}</b>
        <span className="prep-test-when">
          {testDate(t.item)}
          {!past && <span className="soon">{countdown(due, now)}</span>}
        </span>
        <span className="prep-test-cover">{t.cover}</span>
      </button>
    )
  }

  return (
    <aside className="prep" aria-label="Upcoming tests">
      <NotesDrop courseCode={code} summary={notesSummary(notes, weeks)} onFiles={onFiles} />
      <header>
        <h2 className="prep-title">Upcoming tests</h2>
        <p className="prep-sub">{tests.length > 0 ? `${code}. Pick a test to see the weeks it covers.` : code}</p>
      </header>

      {tests.length === 0 ? (
        <div className="prep-empty">
          <p>Nothing in {course.name} is named like a test, so there's no test to prep for. Pick another class above.</p>
          <p className="prep-note">Tests are found by name: “test”, “exam” or “midterm”.</p>
        </div>
      ) : (
        <div className="prep-tests">
          {upcomingTests.length > 0 ? upcomingTests.map(row) : <p className="prep-note">No more tests this term.</p>}
        </div>
      )}

      {unit && (sheetFor === unit.test.id ? (
        <StudySetStep key={unit.test.id} test={unit.test} unit={unit} weeks={weeks} notes={notes} onFiles={onFiles}
          onCreate={(topics) => { setSheetFor(undefined); props.onCreateSet(topics) }} onBack={() => setSheetFor(undefined)} />
      ) : (
        detail()
      ))}

      {pastTests.length > 0 && (
        <>
          <p className="prep-sec">Past tests</p>
          <div className="prep-tests">{pastTests.map(row)}</div>
        </>
      )}
    </aside>
  )

  function detail() {
    if (!unit) return null
    const { test } = unit
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
      <div className="prep-detail">
        {upcoming && total > 0 && (
          <button className="primary-btn prep-cta prep-spark fadein"
            onClick={() => (props.studySetIds.includes(test.id) ? props.onOpenSet(test.id) : setSheetFor(test.id))}>
            <SparkIcon />{props.studySetIds.includes(test.id) ? 'Continue study set' : 'Make a study set'}
          </button>
        )}

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

      </div>
    )
  }
}
