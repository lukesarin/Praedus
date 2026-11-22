import { localDateKey } from '../calendar/dates'
import type { Note, StudyBlocksDB } from '../db/db'
import { mondayOf, type Week } from '../map/units'

/** Leaves room under Claude's 32 MB request limit. */
export const MAX_NOTE_BYTES = 20 * 1024 * 1024

export type NoteInput = { name: string; mime: string; size: number; lastModified?: number; blob?: Blob; text?: string }

const IMAGE = /^image\/(jpeg|png|webp|gif)$/

/** What kind of note a file is, or why it can't be one. */
export function noteKind(name: string, mime: string): Note['kind'] | { reject: string } {
  if (mime === 'application/pdf' || /\.pdf$/i.test(name)) return 'pdf'
  if (IMAGE.test(mime)) return 'image'
  if (mime.startsWith('image/')) return { reject: 'Export it as JPEG or PDF first.' }
  if (mime === 'text/plain' || /\.txt$/i.test(name)) return 'text'
  return { reject: 'Export it as PDF first.' }
}

/** The week a note belongs to: the one its date falls in, else the current week (or the last, once the term is over). */
export function weekForDate(when: number, weeks: Week[], now: Date): string {
  const starts = new Set(weeks.map((w) => w.start))
  const own = mondayOf(localDateKey(new Date(when)))
  if (starts.has(own)) return own
  const current = mondayOf(localDateKey(now))
  if (starts.has(current) || weeks.length === 0) return current
  const last = weeks[weeks.length - 1].start
  return current > last ? last : weeks[0].start
}

/** Adds the files that can be notes; says why each of the others can't. */
export async function addNotes(database: StudyBlocksDB, courseId: string, inputs: NoteInput[], weeks: Week[], now: Date) {
  const added: Note[] = []
  const rejected: { name: string; reason: string }[] = []
  const stamp = Date.now()
  inputs.forEach((f, i) => {
    const kind = noteKind(f.name, f.mime)
    if (typeof kind !== 'string') return void rejected.push({ name: f.name, reason: kind.reject })
    if (f.size > MAX_NOTE_BYTES) return void rejected.push({ name: f.name, reason: 'That file is over 20 MB.' })
    added.push({
      id: crypto.randomUUID(),
      courseId,
      week: weekForDate(f.lastModified ?? now.getTime(), weeks, now),
      name: f.name,
      kind,
      mime: f.mime,
      ...(f.blob ? { blob: f.blob } : {}),
      ...(f.text !== undefined ? { text: f.text } : {}),
      addedAt: new Date(stamp + i).toISOString(),
    })
  })
  if (added.length) await database.notes.bulkAdd(added)
  return { added, rejected }
}

export async function moveNote(database: StudyBlocksDB, id: string, week: string): Promise<void> {
  await database.notes.update(id, { week })
}

export async function deleteNote(database: StudyBlocksDB, id: string): Promise<void> {
  await database.notes.delete(id)
}

/** A class's notes in the given weeks, oldest first. */
export async function notesForWeeks(database: StudyBlocksDB, courseId: string, weekStarts: string[]): Promise<Note[]> {
  const wanted = new Set(weekStarts)
  const all = await database.notes.where('courseId').equals(courseId).toArray()
  return all.filter((n) => wanted.has(n.week)).sort((a, b) => a.addedAt.localeCompare(b.addedAt))
}

/** "12", or "Oct 19" when the term's weeks aren't numbered. */
export function weekLabel(start: string, weeks: Week[]): string {
  const n = weeks.find((w) => w.start === start)?.number
  if (n !== undefined) return String(n)
  const [y, m, d] = start.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

function weekList(notes: Pick<Note, 'week'>[], weeks: Week[]): string {
  const starts = [...new Set(notes.map((n) => n.week))].sort()
  return `${starts.length === 1 ? 'week' : 'weeks'} ${starts.map((s) => weekLabel(s, weeks)).join(', ')}`
}

/** The toast after adding notes: where they went, then why any were skipped. */
export function notesMessage(added: Note[], rejected: { name: string; reason: string }[], weeks: Week[]): string {
  const parts: string[] = []
  if (added.length) {
    const what = added.length === 1 ? added[0].name : `${added.length} notes`
    parts.push(`Added ${what}, sorted into ${weekList(added, weeks)}.`)
  }
  for (const r of rejected) parts.push(`${r.name}: ${r.reason}`)
  return parts.join(' ')
}

/** "6 notes, in weeks 9, 10, 11", or '' when there are none. */
export function notesSummary(notes: Note[], weeks: Week[]): string {
  if (!notes.length) return ''
  return `${notes.length === 1 ? '1 note' : `${notes.length} notes`}, in ${weekList(notes, weeks)}`
}
