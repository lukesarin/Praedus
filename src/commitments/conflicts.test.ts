import { describe, expect, it } from 'vitest'
import type { CalendarItem } from '../db/db'
import { conflictMarks, findConflicts } from './conflicts'
import { localInstant } from './expand'
import type { Occurrence } from './types'

const DAY = '2026-11-24'
const now = localInstant('2026-11-20', '12:00')

function occ(id: string, start: string, end: string, day = DAY): Occurrence {
  return {
    id, commitmentId: id, originalDate: day, date: day, title: id, type: 'other', recurring: false,
    start: localInstant(day, start).toISOString(), end: localInstant(day, end).toISOString(),
  }
}

function due(id: string, time: string, extra: Partial<CalendarItem> = {}): CalendarItem {
  return {
    id, uid: id, feedId: 'f', kind: 'assignment', title: id, allDay: false,
    start: localInstant(DAY, time).toISOString(), done: false, userEdited: false, removedFromSource: false, ...extra,
  }
}

const opts = { now, minGapMinutes: 10 }
const kinds = (cs: ReturnType<typeof findConflicts>) => cs.map((c) => c.kind)

describe('findConflicts', () => {
  it('flags overlapping commitments', () => {
    const cs = findConflicts([occ('work', '16:00', '21:00'), occ('class', '18:00', '19:00')], [], opts)
    expect(kinds(cs)).toEqual(['overlap'])
    expect(cs[0]).toMatchObject({ a: { id: 'work' }, b: { id: 'class' } })
  })

  it('treats touching commitments as a tight squeeze, not an overlap', () => {
    const cs = findConflicts([occ('a', '14:00', '16:00'), occ('b', '16:00', '17:00')], [], opts)
    expect(cs).toHaveLength(1)
    expect(cs[0]).toMatchObject({ kind: 'tight', gapMinutes: 0 })
  })

  it('warns about gaps shorter than the setting only', () => {
    expect(kinds(findConflicts([occ('a', '14:00', '16:00'), occ('b', '16:05', '17:00')], [], opts))).toEqual(['tight'])
    expect(findConflicts([occ('a', '14:00', '16:00'), occ('b', '16:15', '17:00')], [], opts)).toEqual([])
    expect(findConflicts([occ('a', '14:00', '16:00'), occ('b', '16:00', '17:00')], [], { now, minGapMinutes: 0 })).toEqual([])
  })

  it('flags a timed deadline during a commitment', () => {
    const cs = findConflicts([occ('work', '09:00', '13:00')], [due('quiz', '10:00')], opts)
    expect(cs).toHaveLength(1)
    expect(cs[0]).toMatchObject({ kind: 'deadline', occurrence: { id: 'work' }, item: { id: 'quiz' } })
  })

  it('ignores deadlines exactly at the start or end', () => {
    const w = [occ('work', '09:00', '13:00')]
    expect(findConflicts(w, [due('a', '09:00'), due('b', '13:00')], opts)).toEqual([])
  })

  it('skips all-day, done, past and non-assignment items', () => {
    const w = [occ('work', '09:00', '13:00')]
    const items = [
      due('allday', '10:00', { allDay: true, start: DAY }),
      due('done', '10:00', { done: true }),
      due('event', '10:00', { kind: 'event', end: localInstant(DAY, '11:00').toISOString() }),
    ]
    expect(findConflicts(w, items, opts)).toEqual([])
    const past = [occ('old', '09:00', '13:00', '2026-11-10')]
    const pastDue = { ...due('p', '10:00'), start: localInstant('2026-11-10', '10:00').toISOString() }
    expect(findConflicts(past, [pastDue], opts)).toEqual([])
  })

  it('ignores commitments that already ended', () => {
    const cs = findConflicts([occ('a', '09:00', '11:00', '2026-11-19'), occ('b', '10:00', '12:00', '2026-11-19')], [], opts)
    expect(cs).toEqual([])
  })

  it('still checks things from earlier today', () => {
    // Back-to-back classes this morning, checked late at night the same day.
    const lateTonight = localInstant('2026-11-20', '23:19')
    const today = (id: string, start: string, end: string) => occ(id, start, end, '2026-11-20')
    const cs = findConflicts([today('calc', '10:30', '11:30'), today('history', '11:30', '12:30')], [], {
      now: lateTonight,
      minGapMinutes: 10,
    })
    expect(cs).toHaveLength(1)
    expect(cs[0]).toMatchObject({ kind: 'tight', gapMinutes: 0 })
  })

  it('sorts results by time and gives stable ids', () => {
    const cs = findConflicts(
      [occ('late1', '18:00', '20:00'), occ('late2', '19:00', '21:00'), occ('early', '08:00', '12:00')],
      [due('q', '09:00')],
      opts,
    )
    expect(kinds(cs)).toEqual(['deadline', 'overlap'])
    expect(new Set(cs.map((c) => c.id)).size).toBe(2)
  })
})

describe('conflictMarks', () => {
  it('marks red and amber ids, red winning', () => {
    const cs = findConflicts(
      [occ('a', '09:00', '11:00'), occ('b', '10:00', '12:00'), occ('c', '12:00', '13:00')],
      [due('q', '09:30')],
      opts,
    )
    const { red, amber } = conflictMarks(cs)
    expect([...red].sort()).toEqual(['a', 'b', 'q'])
    expect([...amber]).toEqual(['c'])
  })

  it('ignores a deadline kept as history', () => {
    const cs = findConflicts([occ('work', '16:00', '21:00')], [due('old', '18:00', { keptAsHistory: true })], opts)
    expect(kinds(cs)).toEqual([])
  })
})
