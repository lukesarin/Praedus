import { useState } from 'react'
import { db } from '../db/db'
import { setStudySettings, setTermStart } from '../db/settings'
import { normalizeStudySettings, type StudySettings } from './types'

/** Remount (via key) when the saved settings change so inputs start in sync. */
export function StudySettingsForm({ settings, termStart }: { settings: StudySettings; termStart: string | null }) {
  const [draft, setDraft] = useState(settings)
  const save = (next: StudySettings) => {
    setDraft(next)
    void setStudySettings(db, normalizeStudySettings(next))
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
          <input id="term-start" type="date" value={termStart ?? ''}
            onChange={(e) => void setTermStart(db, e.target.value || undefined)} />
          {termStart && <button type="button" className="link-btn" onClick={() => void setTermStart(db, undefined)}>Clear</button>}
        </span>
      </div>
      <p className="muted small">Optional. Numbers the weeks on the study map.</p>
      <p className="muted small">Changes apply the next time you press “Plan my study time”.</p>
    </form>
  )
}
