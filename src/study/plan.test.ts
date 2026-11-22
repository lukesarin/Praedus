import { describe, expect, it } from 'vitest'
import { localDateKey } from '../calendar/dates'
import { expandCommitments, localInstant } from '../commitments/expand'
import type { Commitment } from '../commitments/types'
import type { CalendarItem } from '../db/db'
import { planStudy, type PlanInput } from './plan'
import { DEFAULT_STUDY_SETTINGS, type StudyBlock } from './types'

const at = (day: string, t: string) => localInstant(day, t)
const iso = (day: string, t: string) => at(day, t).toISOString()
const FRI = '2026-11-20'
const now = at(FRI, '08:00') // Friday morning, before study hours

let n = 0
const newId = () => `b${++n}`

function assignment(id: string, due: string, estimateMinutes?: number, extra: Partial<CalendarItem> = {}): CalendarItem {
  const allDay = /^\d{4}-\d{2}-\d{2}$/.test(due)
  return {
    id, uid: id, feedId: 'f', kind: 'assignment', title: id, allDay, start: due,
    done: false, userEdited: false, removedFromSource: false,
    ...(estimateMinutes ? { estimateMinutes } : {}), ...extra,
  }
}

function plan(input: Partial<PlanInput> & { items: CalendarItem[] }) {
  return planStudy({ occurrences: [], blocks: [], settings: DEFAULT_STUDY_SETTINGS, now, newId, ...input })
}

const minutes = (b: StudyBlock) => (Date.parse(b.end) - Date.parse(b.start)) / 60000
const day = (b: StudyBlock) => localDateKey(new Date(b.start))
const hhmm = (s: string) => new Date(s).toTimeString().slice(0, 5)

describe('planStudy', () => {
  it('starts today and spreads a little each day before the deadline', () => {
    const { add, wontFit } = plan({ items: [assignment('hw', iso('2026-11-24', '09:00'), 120)] })
    expect(wontFit).toEqual([])
    expect(add.map((b) => [day(b), hhmm(b.start), minutes(b)])).toEqual([
      ['2026-11-20', '09:00', 30], // Fri (weekday hours)
      ['2026-11-21', '10:00', 30], // Sat (weekend hours)
      ['2026-11-22', '10:00', 30], // Sun
      ['2026-11-23', '09:00', 30], // Mon
    ])
  })

  it('plans around commitments with a buffer on each side', () => {
    const busy: Commitment = {
      id: 'w', title: 'Work', type: 'work', date: '2026-11-16', startTime: '09:00', endTime: '21:00',
      weekly: { days: [0, 1, 2, 3, 4, 5, 6] },
    }
    const occurrences = expandCommitments([busy], FRI, '2026-12-31')
    const { add } = plan({ items: [assignment('hw', iso('2026-11-23', '23:59'), 60)], occurrences })
    expect(add.length).toBeGreaterThan(0)
    for (const b of add) expect(hhmm(b.start) >= '21:15').toBe(true)
    expect(add.reduce((s, b) => s + minutes(b), 0)).toBe(60)
  })

  it('keeps each day under the daily limit and gives scarce time to the earliest deadline', () => {
    const settings = { ...DEFAULT_STUDY_SETTINGS, dailyLimitMinutes: 60 }
    const first = assignment('first', iso('2026-11-21', '22:00'), 120)
    const second = assignment('second', iso('2026-11-21', '23:00'), 120)
    const { add, wontFit } = plan({ items: [second, first], settings })
    const perDay = new Map<string, number>()
    for (const b of add) perDay.set(day(b), (perDay.get(day(b)) ?? 0) + minutes(b))
    for (const total of perDay.values()) expect(total).toBeLessThanOrEqual(60)
    expect(add.every((b) => b.itemId === 'first')).toBe(true)
    expect(wontFit).toEqual([{ itemId: 'second', shortMinutes: 120 }])
  })

  it('reports what will not fit instead of planning past the deadline', () => {
    const tight = plan({ items: [assignment('quiz', iso(FRI, '09:30'), 60)] })
    expect(tight.add.map((b) => [hhmm(b.start), hhmm(b.end)])).toEqual([['09:00', '09:30']])
    expect(tight.wontFit).toEqual([{ itemId: 'quiz', shortMinutes: 30 }])

    const tooLate = plan({ items: [assignment('quiz', iso(FRI, '08:30'), 60)] })
    expect(tooLate.add).toEqual([])
    expect(tooLate.wontFit).toEqual([{ itemId: 'quiz', shortMinutes: 60 }])
  })

  it('counts past and pinned blocks, and never removes them', () => {
    const blocks: StudyBlock[] = [
      { id: 'past', itemId: 'proj', start: iso('2026-11-19', '10:00'), end: iso('2026-11-19', '11:00'), pinned: false },
      { id: 'pin', itemId: 'proj', start: iso('2026-11-21', '10:00'), end: iso('2026-11-21', '11:00'), pinned: true },
    ]
    const { add, remove } = plan({ items: [assignment('proj', iso('2026-11-25', '23:59'), 180)], blocks })
    expect(remove).toEqual([])
    expect(add.reduce((s, b) => s + minutes(b), 0)).toBe(60)
    const pinStart = Date.parse(blocks[1].start)
    const pinEnd = Date.parse(blocks[1].end)
    for (const b of add) expect(Date.parse(b.end) <= pinStart || Date.parse(b.start) >= pinEnd).toBe(true)
  })

  it('replaces its own future blocks when re-planning, and gives the same plan twice', () => {
    const items = [assignment('a', iso('2026-11-24', '09:00'), 120), assignment('b', '2026-11-26', 90)]
    const first = plan({ items })
    const second = plan({ items, blocks: first.add })
    expect(new Set(second.remove)).toEqual(new Set(first.add.map((b) => b.id)))
    const times = (bs: StudyBlock[]) => bs.map((b) => `${b.itemId} ${b.start} ${b.end}`).sort()
    expect(times(second.add)).toEqual(times(first.add))
  })

  it('keeps crossed-out blocks of finished work but frees their time', () => {
    const done = assignment('done', iso('2026-11-23', '12:00'), 120, { done: true })
    const crossed: StudyBlock = { id: 'x', itemId: 'done', start: iso(FRI, '09:00'), end: iso(FRI, '11:00'), pinned: false }
    const { add, remove } = plan({ items: [done, assignment('next', iso(FRI, '23:00'), 60)], blocks: [crossed] })
    expect(remove).toEqual([])
    expect(add[0]).toMatchObject({ itemId: 'next', start: iso(FRI, '09:00') })
  })

  it('finishes all-day deadlines the day before', () => {
    const { add } = plan({ items: [assignment('essay', '2026-11-24', 240)] })
    expect(add.length).toBeGreaterThan(0)
    for (const b of add) expect(Date.parse(b.end) <= Date.parse(iso('2026-11-24', '00:00'))).toBe(true)
  })

  it('never plans in the past and stays on a 15-minute grid', () => {
    const late = at(FRI, '13:07')
    const { add } = plan({ items: [assignment('hw', iso('2026-11-22', '23:59'), 120)], now: late })
    expect(hhmm(add[0].start)).toBe('13:15')
    for (const b of add) expect(new Date(b.start).getMinutes() % 15).toBe(0)
  })

  it('uses the title estimate when none is set, and skips done or past assignments', () => {
    const { add } = plan({
      items: [
        assignment('Quiz 5', iso('2026-11-24', '09:00')),
        assignment('old', iso('2026-11-19', '09:00'), 60),
        assignment('finished', iso('2026-11-24', '09:00'), 60, { done: true }),
      ],
    })
    expect(add.every((b) => b.itemId === 'Quiz 5')).toBe(true)
    expect(add.reduce((s, b) => s + minutes(b), 0)).toBe(60)
  })

  it('never makes a block shorter than the minimum, even for a small leftover', () => {
    // 60 of 75 minutes were already studied, leaving a 15-minute scrap.
    const studied: StudyBlock = { id: 'p', itemId: 'hw', start: iso('2026-11-19', '10:00'), end: iso('2026-11-19', '11:00'), pinned: false }
    const { add } = plan({ items: [assignment('hw', iso('2026-11-22', '00:00'), 75)], blocks: [studied] })
    expect(add.map(minutes)).toEqual([30])
  })

  it('removes future blocks whose assignment no longer exists', () => {
    const orphan: StudyBlock = { id: 'o', itemId: 'gone', start: iso('2026-11-21', '10:00'), end: iso('2026-11-21', '11:00'), pinned: false }
    expect(plan({ items: [], blocks: [orphan] }).remove).toEqual(['o'])
  })

  it('planStudy places blocks before a test that is a calendar event', () => {
    const start = iso('2026-11-23', '10:00')
    const ev = assignment('mid', start, undefined, { kind: 'event', title: 'Midterm Exam' })
    const { add } = plan({ items: [ev] })
    const mine = add.filter((b) => b.itemId === 'mid')
    expect(mine.length).toBeGreaterThan(0)
    for (const b of mine) expect(Date.parse(b.end)).toBeLessThanOrEqual(Date.parse(start))
    expect(mine.reduce((s, b) => s + minutes(b), 0)).toBe(240)
  })

  it('plans a test posted as both an assignment and an event only once', () => {
    const due = '2026-11-25'
    const items = [
      assignment('a', due, undefined, { title: 'Midterm Exam', courseId: 'c' }),
      assignment('e', due, undefined, { title: 'midterm exam', kind: 'event', courseId: 'c' }),
    ]
    const { add } = plan({ items })
    expect(new Set(add.map((b) => b.itemId))).toEqual(new Set(['e']))
    expect(add.reduce((sum, b) => sum + minutes(b), 0)).toBe(240)
  })

  it('places no blocks for a past item kept as history', () => {
    const { add } = plan({ items: [assignment('old', iso('2026-11-18', '09:00'), 120, { keptAsHistory: true })] })
    expect(add).toEqual([])
  })
})
