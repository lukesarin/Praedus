import { describe, expect, it } from 'vitest'
import { addDays } from '../calendar/dates'
import { localInstant } from '../commitments/expand'
import type { CalendarItem, Course } from '../db/db'
import { buildDonut, courseCode, isLate, MAX_DOTS, sliceAngles } from './donut'

const TERM = '2026-08-24'
const TAU = Math.PI * 2
let n = 0
/** Date in week `w` (1 = the term's first week), weekday 0 = Monday. */
const day = (w: number, wd = 0) => addDays(TERM, (w - 1) * 7 + wd)
function mk(kind: 'assignment' | 'event', title: string, date: string, extra: Partial<CalendarItem> = {}): CalendarItem {
  n += 1
  return {
    id: `f|${n}`, uid: String(n), feedId: 'f', kind, title, start: date, allDay: true,
    courseId: 'math', done: false, userEdited: false, removedFromSource: false, ...extra,
  }
}
const a = (title: string, w: number, extra: Partial<CalendarItem> = {}) => mk('assignment', title, day(w, 2), extra)
const e = (title: string, w: number, extra: Partial<CalendarItem> = {}) => mk('event', title, day(w, 2), extra)

const math: Course = { id: 'math', name: 'MATH 120', color: '#4fa3d1' }
const now = localInstant(day(10, 2), '12:00') // Wednesday of week 10

const test1 = e('Test 1', 4)
const test2 = e('Test 2', 8)
const test3 = e('Test 3', 14)
const hw3 = a('HW 3', 3)
const hw9 = a('HW 9', 9, { done: true })
const hw10 = a('HW 10', 10)
const hw12 = a('HW 12', 12, { reviewed: true })
const hw16 = a('HW 16', 16)
const mine = [test1, test2, test3, hw3, hw9, hw10, hw12, hw16]
const others = [a('Lab', 9, { courseId: 'cs' }), e('Review session', 13), e('Class picnic', 12)]
const all = [...mine, ...others]
const build = (testId?: string, extra: { termStart?: string; items?: CalendarItem[] } = {}) =>
  buildDonut({ course: math, items: extra.items ?? all, termStart: 'termStart' in extra ? extra.termStart : TERM, testId, now })
const week = (d: ReturnType<typeof build>, w: number) => d.weeks.find((x) => x.week.start === day(w))!

describe('sliceAngles', () => {
  it('starts at twelve o\'clock plus the gap and ends a full turn minus the gap', () => {
    expect(sliceAngles(0, 16)[0]).toBeCloseTo(0.012)
    expect(sliceAngles(15, 16)[1]).toBeCloseTo(TAU - 0.012)
  })
  it('makes equal slices for any count', () => {
    for (const count of [1, 3, 16, 20]) {
      const widths = Array.from({ length: count }, (_, i) => sliceAngles(i, count)).map(([x, y]) => y - x)
      for (const w of widths) expect(w).toBeCloseTo(widths[0])
    }
    const [x, y] = sliceAngles(1, 3)
    expect(y - x).toBeCloseTo(TAU / 3, 1)
  })
  it('never lets a slice vanish', () => {
    const [x, y] = sliceAngles(0, 20, 5)
    expect(y).toBeGreaterThan(x)
  })
})

describe('buildDonut', () => {
  const d = build(test3.id)

  it('has one slice per week, equal and in order', () => {
    expect(d.weeks).toHaveLength(16)
    expect(week(d, 9).label).toBe('9')
    expect(d.weeks[0].a0).toBeCloseTo(0.012)
    expect(d.weeks[15].a1).toBeCloseTo(TAU - 0.012)
    for (let i = 1; i < d.weeks.length; i++) expect(d.weeks[i].a0).toBeGreaterThan(d.weeks[i - 1].a1)
  })

  it('flags the picked test and its unit weeks', () => {
    expect(d.weeks.filter((w) => w.inUnit).map((w) => w.label)).toEqual(['9', '10', '11', '12', '13'])
    expect(d.unit?.test.id).toBe(test3.id)
    expect(d.tests.map((t) => t.item.title)).toEqual(['Test 1', 'Test 2', 'Test 3'])
    expect(d.tests.filter((t) => t.picked).map((t) => t.item.id)).toEqual([test3.id])
  })

  it('has no unit when nothing is picked or the pick is not a test of this class', () => {
    for (const x of [build(), build(hw3.id), build('nope')]) {
      expect(x.unit).toBeUndefined()
      expect(x.weeks.some((w) => w.inUnit)).toBe(false)
      expect(x.tests.some((t) => t.picked)).toBe(false)
    }
  })

  it('marks only the current week as now', () => {
    expect(d.weeks.filter((w) => w.now).map((w) => w.week.start)).toEqual([day(10)])
  })

  it('puts each week\'s assignments in its dots and leaves out tests and other classes', () => {
    const titles = d.weeks.flatMap((w) => w.dots.map((x) => x.item.title)).sort()
    expect(titles).toEqual(['HW 10', 'HW 12', 'HW 16', 'HW 3', 'HW 9'])
    expect(week(d, 9).dots.map((x) => x.item.id)).toEqual([hw9.id])
  })

  it('shows at most MAX_DOTS dots and counts the rest', () => {
    const seven = Array.from({ length: 7 }, (_, i) => mk('assignment', `P${i}`, day(5, i)))
    const r = build(undefined, { items: [...seven, hw3] })
    expect(MAX_DOTS).toBe(5)
    expect(week(r, 5).dots.map((x) => x.item.title)).toEqual(['P0', 'P1', 'P2', 'P3', 'P4'])
    expect(week(r, 5).more).toBe(2)
    expect(week(r, 3).more).toBe(0)
  })

  it('places a test inside its week, at the time it falls', () => {
    const t = d.tests.find((x) => x.item.id === test3.id)!
    const w = week(d, 14)
    expect(t.angle).toBeGreaterThan(w.a0)
    expect(t.angle).toBeLessThan(w.a1)
    // Wednesday: 2 of 7 days in.
    const monday = mk('event', 'Test 4', day(14, 0), { allDay: false, start: localInstant(day(14, 0), '00:00').toISOString() })
    const sunday = mk('event', 'Test 5', day(14, 6), { allDay: false, start: localInstant(day(14, 6), '23:30').toISOString() })
    const r = build(undefined, { items: [monday, sunday, hw3] })
    const w14 = week(r, 14)
    expect(r.tests[0].angle).toBeCloseTo(w14.a0)
    expect(r.tests[1].angle).toBeGreaterThan(w14.a0 + (w14.a1 - w14.a0) * 0.95)
  })

  it('moves a test close to an earlier one out to the second lane', () => {
    const q1 = e('Test A', 6)
    const q2 = mk('event', 'Test B', day(6, 2))
    const r = build(undefined, { items: [q1, q2, hw3] })
    expect(r.tests.map((t) => t.lane)).toEqual([0, 1])
    expect(d.tests.map((t) => t.lane)).toEqual([0, 0, 0])
  })

  it('marks tests already past', () => {
    expect(d.tests.map((t) => t.past)).toEqual([true, true, false])
  })

  it('marks done, late and reviewed', () => {
    const dot = (id: string) => d.weeks.flatMap((w) => w.dots).find((x) => x.item.id === id)!
    expect(dot(hw9.id).status).toBe('done')
    expect(dot(hw3.id).status).toBe('late')
    expect(dot(hw16.id).status).toBeUndefined()
    expect(dot(hw12.id).reviewed).toBe(true)
    expect(dot(hw10.id).reviewed).toBe(false)
  })

  it('does not call all-day work due today late', () => {
    const today = mk('assignment', 'Today', day(10, 2))
    const r = build(undefined, { items: [today] })
    expect(r.weeks.find((x) => x.dots.length)!.dots[0].status).toBeUndefined()
  })

  it('labels unnumbered weeks by date', () => {
    const u = build(undefined, { termStart: undefined, items: [a('HW 1', 9), a('HW 2', 10)] })
    expect(u.weeks.map((w) => w.label)).toEqual(['Oct 19', 'Oct 26'])
  })

  it('shows a collapsed duplicate test once, as the event', () => {
    const dupA = a('Midterm exam', 6)
    const dupE = e('Midterm exam', 6)
    const r = build(dupA.id, { items: [dupA, dupE, hw3] })
    expect(r.tests.map((t) => t.item.id)).toEqual([dupE.id])
    expect(r.tests[0].picked).toBe(true)
    expect(r.weeks.flatMap((w) => w.dots).some((x) => x.item.id === dupA.id)).toBe(false)
  })

  it('leaves out items and tests from before the term start', () => {
    const early = a('Old', -2)
    const placement = e('Placement test', 0)
    const r = build(placement.id, { items: [early, placement, ...all] })
    expect(r.weeks.flatMap((w) => w.dots).some((x) => x.item.id === early.id)).toBe(false)
    expect(r.tests.map((t) => t.item.title)).toEqual(['Test 1', 'Test 2', 'Test 3'])
    expect(r.unit).toBeUndefined()
  })

  it('is empty with no items', () => {
    const r = build(undefined, { items: [] })
    expect(r.weeks).toEqual([])
    expect(r.tests).toEqual([])
  })
})

describe('courseCode', () => {
  it('shortens a Canvas course name to its subject and number', () => {
    expect(courseCode('CS 210 Intro to Programming')).toBe('CS 210')
    expect(courseCode('ENGL 101A Composition')).toBe('ENGL 101A')
    expect(courseCode('MATH 120')).toBe('MATH 120')
  })

  it('keeps short names without a code, and shortens long ones', () => {
    expect(courseCode('Biology')).toBe('Biology')
    expect(courseCode('Introduction to Modern Philosophy')).toBe('Introduction to…')
    expect(courseCode('Introduction to Modern Philosophy')).toHaveLength(16)
  })
})

describe('isLate', () => {
  const noon = localInstant('2026-11-20', '12:00')
  const item = (start: string, allDay: boolean): CalendarItem => mk('assignment', 'x', start, { allDay })
  it('is not late for all-day work due today', () => {
    expect(isLate(item('2026-11-20', true), noon)).toBe(false)
  })
  it('is late for all-day work once its day has ended', () => {
    expect(isLate(item('2026-11-19', true), noon)).toBe(true)
  })
  it('is late for timed work after its time', () => {
    expect(isLate(item(localInstant('2026-11-20', '11:00').toISOString(), false), noon)).toBe(true)
    expect(isLate(item(localInstant('2026-11-20', '13:00').toISOString(), false), noon)).toBe(false)
  })
})
