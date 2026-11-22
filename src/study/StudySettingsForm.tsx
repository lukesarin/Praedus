import { useState } from 'react'
import { db } from '../db/db'
import { normalizeTermStart, setStudySettings, setTermStart } from '../db/settings'
import { normalizeStudySettings, type StudySettings } from './types'

/** Remount (via key) when the saved settings change so inputs start in sync. */
export function StudySettingsForm({ settings, termStart }: { settings: StudySettings; termStart: string | null }) {
  const [draft, setDraft] = useState(settings)
  const [termDraft, setTermDraft] = useState(termStart ?? '')
  const save = (next: StudySettings) => {
    setDraft(next)
    void setStudySettings(db, normalizeStudySettings(next))
  }
  // The date input emits partial years while typing ("0002-..."), so save only on blur or Enter.
  const saveTerm = (value: string) => {
    if (value && normalizeTermStart(value) === undefined) {
      setTermDraft(termStart ?? '') // not a usable date: keep the saved one
      return
    }
    void setTermStart(db, value || undefined)
  }
  const num = (field: keyof StudySettings, factor = 1) => ({
    type: 'number',
    value: String((draft[field] as number) / factor),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, [field]: Number(e.target.value) * factor }),
    onBlur: () => save(draft),
  })

  return (
    <form className="study-settings" onSubmit={(e) => { e.preventDefault(); save(draft) }}>
      <h2>Study settings</h2>
      <div className="settings-grid">
        <span>Weekdays</span>
        <span className="time-range">
          <input type="time" aria-label="Weekday study start" value={draft.weekday.start}
            onChange={(e) => save({ ...draft, weekday: { ...draft.weekday, start: e.target.value } })} />
          to
          <input type="time" aria-label="Weekday study end" value={draft.weekday.end}
            onChange={(e) => save({ ...draft, weekday: { ...draft.weekday, end: e.target.value } })} />
        </span>
        <span>Weekends</span>
        <span className="time-range">
          <input type="time" aria-label="Weekend study start" value={draft.weekend.start}
            onChange={(e) => save({ ...draft, weekend: { ...draft.weekend, start: e.target.value } })} />
          to
          <input type="time" aria-label="Weekend study end" value={draft.weekend.end}
            onChange={(e) => save({ ...draft, weekend: { ...draft.weekend, end: e.target.value } })} />
        </span>
        <label htmlFor="limit">Daily limit</label>
        <span><input id="limit" min={0} max={16} step={0.25} {...num('dailyLimitMinutes', 60)} /> hours</span>
        <label htmlFor="buffer">Buffer around commitments</label>
        <span><input id="buffer" min={0} max={120} step={15} {...num('bufferMinutes')} /> minutes</span>
        <label htmlFor="chunk-min">Shortest block</label>
        <span><input id="chunk-min" min={15} max={240} step={15} {...num('chunkMinMinutes')} /> minutes</span>
        <label htmlFor="chunk-max">Longest block</label>
        <span><input id="chunk-max" min={15} max={480} step={15} {...num('chunkMaxMinutes')} /> minutes</span>
        <label htmlFor="term-start">First day of classes</label>
        <span>
          <input id="term-start" type="date" value={termDraft} min="2000-01-01" max="2100-12-31"
            onChange={(e) => setTermDraft(e.target.value)}
            onBlur={(e) => saveTerm(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') saveTerm(e.currentTarget.value) }} />
          {(termStart || termDraft) && (
            <button type="button" className="link-btn" onClick={() => { setTermDraft(''); saveTerm('') }}>Clear</button>
          )}
        </span>
      </div>
      <p className="muted small">Optional. Numbers the weeks on the study map.</p>
      <p className="muted small">Changes apply the next time you press “Plan my study time”.</p>
    </form>
  )
}
