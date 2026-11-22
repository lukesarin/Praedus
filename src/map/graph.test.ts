import { describe, expect, it } from 'vitest'
import { addDays } from '../calendar/dates'
import { localInstant } from '../commitments/expand'
import type { CalendarItem, Course } from '../db/db'
import { buildClassGraph, courseCode, isLate } from './graph'

const TERM = '2026-08-24'
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
const others = [
  a('Lab', 9, { courseId: 'cs' }),
  e('Review session', 13),
  e('Class picnic', 12),
]
const all = [...mine, ...others]
const build = (testId?: string, extra: { termStart?: string; items?: CalendarItem[] } = {}) =>
  buildClassGraph({ course: math, items: extra.items ?? all, termStart: 'termStart' in extra ? extra.termStart : TERM, testId, now })
const node = (g: ReturnType<typeof build>, id: string) => g.nodes.find((x) => x.id === id)!

describe('buildClassGraph', () => {
  const g = build(test3.id)

  it('has the course, its 16 weeks, spine links and spokes', () => {
    expect(g.nodes.filter((x) => x.kind === 'course')).toHaveLength(1)
    expect(g.nodes.filter((x) => x.kind === 'week')).toHaveLength(16)
    expect(g.links.filter((l) => l.kind === 'spine')).toHaveLength(15)
    expect(g.links.filter((l) => l.kind === 'spoke')).toHaveLength(16)
    expect(node(g, 'course:math')).toMatchObject({ kind: 'course', label: 'MATH 120', refId: 'math' })
    expect(node(g, `week:${day(9)}`)).toMatchObject({ label: '9', refId: day(9) })
  })

  it('joins every assignment and test to its week and leaves out others', () => {
    const items = g.nodes.filter((x) => x.kind === 'assignment' || x.kind === 'test')
    expect(items).toHaveLength(mine.length)
    for (const i of items) {
      expect(g.links).toContainEqual({ source: `week:${i.week}`, target: i.id, kind: 'item' })
    }
    expect(g.nodes.map((x) => x.label)).not.toContain('Lab')
    expect(g.nodes.map((x) => x.label)).not.toContain('Review session')
    expect(g.nodes.map((x) => x.label)).not.toContain('Class picnic')
    expect(node(g, `item:${test1.id}`).kind).toBe('test')
    expect(node(g, `item:${hw3.id}`).kind).toBe('assignment')
  })

  it('flags the picked test and its unit', () => {
    const inUnit = g.nodes.filter((x) => x.inUnit)
    const weekNums = inUnit.filter((x) => x.kind === 'week').map((x) => x.label)
    expect(weekNums).toEqual(['9', '10', '11', '12', '13'])
    const unitItems = inUnit.filter((x) => x.kind === 'assignment').map((x) => x.label).sort()
    expect(unitItems).toEqual(['HW 10', 'HW 12', 'HW 9'])
    expect(g.nodes.filter((x) => x.picked).map((x) => x.id)).toEqual([`item:${test3.id}`])
    expect(g.unit?.test.id).toBe(test3.id)
    expect(g.tests.map((t) => t.title)).toEqual(['Test 1', 'Test 2', 'Test 3'])
    expect(g.weeks).toHaveLength(16)
  })

  it('has no unit when nothing is picked or the pick is not a test of this class', () => {
    for (const gg of [build(), build(hw3.id), build('nope')]) {
      expect(gg.unit).toBeUndefined()
      expect(gg.nodes.some((x) => x.inUnit || x.picked)).toBe(false)
    }
  })

  it('marks the current week', () => {
    expect(g.nodes.filter((x) => x.now).map((x) => x.id)).toEqual([`week:${day(10)}`])
  })

  it('marks done, late and reviewed', () => {
    expect(node(g, `item:${hw9.id}`).status).toBe('done')
    expect(node(g, `item:${hw3.id}`).status).toBe('late')
    expect(node(g, `item:${hw16.id}`).status).toBeUndefined()
    expect(node(g, `item:${test1.id}`).status).toBeUndefined()
    expect(node(g, `item:${hw12.id}`).reviewed).toBe(true)
    expect(node(g, `item:${hw10.id}`).reviewed).toBeUndefined()
  })

  it('labels unnumbered weeks by date', () => {
    const u = build(undefined, { termStart: undefined, items: [a('HW 1', 9), a('HW 2', 10)] })
    expect(u.nodes.filter((x) => x.kind === 'week').map((x) => x.label)).toEqual(['Oct 19', 'Oct 26'])
  })

  it('shows a collapsed duplicate test once, as the event', () => {
    const dupA = a('Midterm exam', 6)
    const dupE = e('Midterm exam', 6)
    const d = build(dupA.id, { items: [dupA, dupE, hw3] })
    expect(d.nodes.filter((x) => x.kind === 'test').map((x) => x.id)).toEqual([`item:${dupE.id}`])
    expect(d.nodes.some((x) => x.id === `item:${dupA.id}`)).toBe(false)
    expect(node(d, `item:${dupE.id}`).picked).toBe(true)
  })

  it('leaves out items before the term start', () => {
    const early = a('Old', -2)
    const r = build(undefined, { items: [early, hw3] })
    expect(r.nodes.some((x) => x.id === `item:${early.id}`)).toBe(false)
  })

  it('is just the course with no items', () => {
    const r = build(undefined, { items: [] })
    expect(r.nodes.map((x) => x.kind)).toEqual(['course'])
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

describe('tests the map cannot show', () => {
  it('leaves out a test from before the first day of classes', () => {
    const early = e('Placement test', 0)
    const g = build(undefined, { items: [early, ...all] })
    expect(g.tests.map((t) => t.title)).toEqual(['Test 1', 'Test 2', 'Test 3'])
    expect(build(early.id, { items: [early, ...all] }).unit).toBeUndefined()
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
