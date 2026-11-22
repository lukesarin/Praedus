import { afterEach, describe, expect, it } from 'vitest'
import { localInstant } from '../commitments/expand'
import { StudyBlocksDB } from '../db/db'
import type { Week } from '../map/units'
import { addNotes, deleteNote, MAX_NOTE_BYTES, moveNote, noteKind, notesForWeeks, weekForDate } from './notes'

const database = new StudyBlocksDB('notes-test')
afterEach(async () => {
  await database.delete()
  await database.open()
})

const weeks: Week[] = Array.from({ length: 16 }, (_, i) => {
  const d = new Date(Date.UTC(2026, 7, 24 + i * 7))
  return { start: d.toISOString().slice(0, 10), number: i + 1 }
})
const wk = (n: number) => weeks[n - 1].start
const at = (n: number, day = 2) => localInstant(wk(n), '12:00').getTime() + day * 86_400_000
const now = new Date(at(13))

describe('noteKind', () => {
  it('accepts PDFs, images and text, and says what to do with the rest', () => {
    expect(noteKind('a.pdf', 'application/pdf')).toBe('pdf')
    expect(noteKind('b.jpg', 'image/jpeg')).toBe('image')
    expect(noteKind('c.txt', 'text/plain')).toBe('text')
    expect(noteKind('x.heic', 'image/heic')).toEqual({ reject: 'Export it as JPEG or PDF first.' })
    expect(noteKind('s.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation')).toEqual({
      reject: 'Export it as PDF first.',
    })
  })
})

describe('weekForDate', () => {
  it('uses the week the date falls in', () => {
    expect(weekForDate(at(10), weeks, now)).toBe(wk(10))
  })
  it('puts dates outside the term in the current week', () => {
    expect(weekForDate(at(10) - 365 * 86_400_000, weeks, now)).toBe(wk(13))
  })
  it('uses the last week once the term is over', () => {
    const later = new Date(at(16) + 30 * 86_400_000)
    expect(weekForDate(at(1) - 365 * 86_400_000, weeks, later)).toBe(wk(16))
  })
})

describe('addNotes', () => {
  const pdf = (name: string, size = 1000) => ({ name, mime: 'application/pdf', size, lastModified: at(10), blob: new Blob(['%PDF']) })
  it('adds the good files and explains each bad one', async () => {
    const { added, rejected } = await addNotes(database, 'math', [
      pdf('good.pdf'),
      { name: 'slides.pptx', mime: 'application/vnd.ms-powerpoint', size: 10, lastModified: at(10) },
      pdf('huge.pdf', MAX_NOTE_BYTES + 1),
      { name: 'photo.jpg', mime: 'image/jpeg', size: 10, lastModified: at(11), blob: new Blob(['x']) },
    ], weeks, now)
    expect(added.map((n) => n.name)).toEqual(['good.pdf', 'photo.jpg'])
    expect(rejected).toEqual([
      { name: 'slides.pptx', reason: 'Export it as PDF first.' },
      { name: 'huge.pdf', reason: 'That file is over 20 MB.' },
    ])
    expect(await database.notes.count()).toBe(2)
    expect(added[1].week).toBe(wk(11))
  })
  it('keeps pasted text in the current week', async () => {
    const { added } = await addNotes(database, 'math', [{ name: 'Pasted notes', mime: 'text/plain', size: 5, text: 'chain rule' }], weeks, now)
    expect(added[0]).toMatchObject({ kind: 'text', week: wk(13), name: 'Pasted notes', text: 'chain rule' })
  })
})

describe('moving, deleting and finding notes', () => {
  it('works per class and week, oldest first', async () => {
    const one = (name: string, n: number) => ({ name, mime: 'text/plain', size: 1, text: name, lastModified: at(n) })
    const { added } = await addNotes(database, 'math', [one('a', 9), one('b', 10)], weeks, now)
    await addNotes(database, 'cs', [one('c', 9)], weeks, now)
    await moveNote(database, added[0].id, wk(12))
    expect((await database.notes.get(added[0].id))!.week).toBe(wk(12))
    expect((await notesForWeeks(database, 'math', [wk(10), wk(12)])).map((n) => n.name)).toEqual(['a', 'b'])
    await deleteNote(database, added[1].id)
    expect((await notesForWeeks(database, 'math', [wk(10), wk(12)])).map((n) => n.name)).toEqual(['a'])
  })
})
