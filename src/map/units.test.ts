import { describe, expect, it } from 'vitest'
import type { CalendarItem, Course } from '../db/db'
import { addDays } from '../calendar/dates'
import { classWeeks, defaultPick, defaultTestFor, mondayOf, testsOf, unitFor } from './units'

const TERM = '2026-08-24'
let n = 0
/** Date in week `w` (1 = the term's first week), weekday 0 = Monday. */
const day = (w: number, wd = 0) => addDays(TERM, (w - 1) * 7 + wd)
function mk(kind: 'assignment' | 'event', title: string, date: string, courseId = 'math'): CalendarItem {
  n += 1
  return {
    id: `f|${n}`, uid: String(n), feedId: 'f', kind, title, start: date, allDay: true,
    courseId, done: false, userEdited: false, removedFromSource: false,
  }
}
const a = (title: string, w: number, wd = 0, c?: string) => mk('assignment', title, day(w, wd), c)
const e = (title: string, w: number, wd = 0, c?: string) => mk('event', title, day(w, wd), c)

describe('mondayOf', () => {
  it('finds the Monday', () => {
    expect(mondayOf('2026-08-30')).toBe('2026-08-24')
    expect(mondayOf('2026-08-24')).toBe('2026-08-24')
  })
})

describe('classWeeks', () => {
  it('runs from the earliest to the latest item, unnumbered without a term start', () => {
    const w = classWeeks([a('HW 1', 9), a('HW 2', 13)])
    expect(w).toHaveLength(5)
    expect(w[0]).toEqual({ start: '2026-10-19' })
  })
  it('numbers from the term start', () => {
    const w = classWeeks([a('HW 1', 9), a('HW 2', 13)], TERM)
    expect(w).toHaveLength(13)
    expect(w[12].number).toBe(13)
    expect(w[0].number).toBe(1)
  })
  it('leaves off items before the term', () => {
    expect(classWeeks([a('Old', -2), a('HW', 2)], TERM)).toHaveLength(2)
  })
  it('keeps the most recent 20 weeks', () => {
    const w = classWeeks([a('HW', 1), a('HW', 25)])
    expect(w).toHaveLength(20)
    expect(w[19].start).toBe(day(25))
  })
  it('is empty with no items', () => expect(classWeeks([])).toEqual([]))
})

describe('testsOf', () => {
  it('sorts tests by due date', () => {
    const t3 = a('Test 3', 14), t1 = a('Test 1', 4), t2 = a('Test 2', 8)
    expect(testsOf([t3, a('HW', 2), t1, t2]).map((t) => t.title)).toEqual(['Test 1', 'Test 2', 'Test 3'])
  })
  it('collapses an assignment and event pair into the event', () => {
    const r = testsOf([a('Midterm exam', 8), e('Midterm exam', 8)])
    expect(r).toHaveLength(1)
    expect(r[0].kind).toBe('event')
  })
})

describe('unitFor', () => {
  it('covers the weeks between tests with their assignments', () => {
    const t2 = a('Test 2', 8), t3 = a('Test 3', 14)
    const hw = [a('Problem set 5', 9), a('Quiz 4', 11), a('Problem set 6', 13)]
    const items = [a('Start', 1), t2, t3, ...hw, a('Late', 14), e('Lecture', 10)]
    const u = unitFor(t3, items, classWeeks(items, TERM), TERM)
    expect(u.weeks.map((w) => w.number)).toEqual([9, 10, 11, 12, 13])
    expect(u.items).toEqual(hw)
    expect(u.previous).toBe(t2)
    expect(u.cumulative).toBe(false)
  })
  it('covers weeks 4-6 between tests in weeks 3 and 7', () => {
    const items = [a('HW', 1), a('Test 2', 3), a('Test 3', 7)]
    const u = unitFor(items[2], items, classWeeks(items, TERM), TERM)
    expect(u.weeks.map((w) => w.number)).toEqual([4, 5, 6])
  })
  it('first test: weeks 1-3 with a term start, no earliestKnown', () => {
    const items = [a('HW', 1), a('Test 1', 4)]
    const u = unitFor(items[1], items, classWeeks(items, TERM), TERM)
    expect(u.weeks.map((w) => w.number)).toEqual([1, 2, 3])
    expect(u.earliestKnown).toBeUndefined()
  })
  it('first test without a term start sets earliestKnown', () => {
    const items = [a('HW', 2, 2), a('Test 1', 4)]
    const u = unitFor(items[1], items, classWeeks(items))
    expect(u.earliestKnown).toBe(day(2, 2))
  })
  it('with a term start, earliestKnown when the earliest item is after the first week', () => {
    const items = [a('HW', 2), a('Test 1', 4)]
    const u = unitFor(items[1], items, classWeeks(items, TERM), TERM)
    expect(u.earliestKnown).toBe(day(2))
  })
  it('a final is cumulative from the first week', () => {
    const items = [a('HW', 1), a('Test 1', 4), a('Test 2', 9), a('Final exam', 16)]
    const u = unitFor(items[3], items, classWeeks(items, TERM), TERM)
    expect(u.cumulative).toBe(true)
    expect(u.weeks.map((w) => w.number)).toEqual(Array.from({ length: 15 }, (_, i) => i + 1))
    expect(u.items.map((i) => i.title)).toEqual(['HW'])
  })
  it('a final with a previous test sets earliestKnown without a term start only', () => {
    const items = [a('HW', 1), a('Test 1', 4), a('Final exam', 16)]
    expect(unitFor(items[2], items, classWeeks(items)).earliestKnown).toBe(day(1))
    expect(unitFor(items[2], items, classWeeks(items, TERM), TERM).earliestKnown).toBeUndefined()
  })
  it('resolves a collapsed-away duplicate to the kept test', () => {
    const t1 = a('Test 1', 3), dup = a('Midterm exam', 8), ev = e('Midterm exam', 8), t3 = a('Test 3', 12)
    const items = [a('HW', 1), t1, dup, ev, t3]
    const u = unitFor(dup, items, classWeeks(items, TERM), TERM)
    expect(u.test).toBe(ev)
    expect(u.previous).toBe(t1)
    expect(u.weeks.map((w) => w.number)).toEqual([4, 5, 6, 7])
  })
  it('back-to-back tests leave an empty unit', () => {
    const items = [a('HW', 2), a('Midterm', 8), a('Test 2', 9)]
    const u = unitFor(items[2], items, classWeeks(items, TERM), TERM)
    expect(u.weeks).toEqual([])
    expect(u.items).toEqual([])
  })
  it('same-week tests leave the later one empty', () => {
    const items = [a('HW', 2), a('Midterm', 8, 0), a('Test 2', 8, 3)]
    const u = unitFor(items[2], items, classWeeks(items, TERM), TERM)
    expect(u.weeks).toEqual([])
    expect(u.items).toEqual([])
  })
})

describe('defaultPick', () => {
  const courses: Course[] = [
    { id: 'math', name: 'MATH 101', color: '#000' },
    { id: 'cs', name: 'CS 201', color: '#000' },
    { id: 'engl', name: 'ENGL 100', color: '#000' },
  ]
  const items = [
    mk('assignment', 'Test 3', '2026-11-24', 'math'),
    mk('assignment', 'Final exam', '2026-12-09', 'cs'),
    mk('assignment', 'Test 1', '2026-09-20', 'math'),
  ]
  it('picks the soonest upcoming test', () => {
    expect(defaultPick(courses, items, new Date(2026, 10, 21))).toEqual({ courseId: 'math', testId: items[0].id })
  })
  it('falls back to the first class alphabetically with its latest test', () => {
    expect(defaultPick(courses, items, new Date(2027, 0, 5))).toEqual({ courseId: 'cs', testId: items[1].id })
  })
  it('works with a class that has no tests', () => {
    expect(defaultPick(courses, [a('Essay', 1, 0, 'engl')], new Date(2027, 0, 5))).toEqual({ courseId: 'engl' })
  })
  it('returns the event when an assignment duplicate comes first', () => {
    const dup = mk('assignment', 'Midterm exam', '2026-11-24', 'math')
    const ev = mk('event', 'Midterm exam', '2026-11-24', 'math')
    expect(defaultPick(courses, [dup, ev], new Date(2026, 10, 21))).toEqual({ courseId: 'math', testId: ev.id })
  })
  it('is null with no items', () => expect(defaultPick(courses, [], new Date())).toBeNull())
})

describe('defaultTestFor', () => {
  const t1 = mk('assignment', 'Test 1', '2026-09-20')
  const t2 = mk('assignment', 'Test 2', '2026-10-20')
  const t3 = mk('assignment', 'Test 3', '2026-11-24')
  const hw = mk('assignment', 'Homework 4', '2026-11-01')
  it('picks the next upcoming test', () => {
    expect(defaultTestFor([t3, hw, t1, t2], new Date(2026, 9, 1))?.id).toBe(t2.id)
  })
  it('picks the latest test when all are past', () => {
    expect(defaultTestFor([t3, hw, t1, t2], new Date(2027, 0, 5))?.id).toBe(t3.id)
  })
  it('is undefined with no tests', () => {
    expect(defaultTestFor([hw], new Date(2026, 9, 1))).toBeUndefined()
  })
})
