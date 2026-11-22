import { describe, expect, it } from 'vitest'
import { DEFAULT_EVENT_COLOR } from '../calendar/toEvents'
import { localInstant } from '../commitments/expand'
import type { Commitment } from '../commitments/types'
import type { CalendarItem, Course } from '../db/db'
import type { StudyBlock } from '../study/types'
import { buildGraph, courseCode, DEFAULT_MAP_FILTERS, ringDistance, type MapFilters } from './graph'

const now = localInstant('2026-11-21', '12:00')
const iso = (d: string, t: string) => localInstant(d, t).toISOString()
const courses: Course[] = [
  { id: 'cs', name: 'CS 210', color: '#8b7cf6' },
  { id: 'math', name: 'MATH 120', color: '#4fa3d1' },
  { id: 'old', name: 'Old course', color: '#5fb88a' },
]
const item = (id: string, due: string, extra: Partial<CalendarItem> = {}): CalendarItem => ({
  id, uid: id, feedId: 'f', kind: 'assignment', title: id, start: due, allDay: false,
  done: false, userEdited: false, removedFromSource: false, courseId: 'cs', ...extra,
})
const block = (id: string, itemId: string, day: string, t1: string, t2: string): StudyBlock => ({
  id, itemId, start: iso(day, t1), end: iso(day, t2), pinned: false,
})

const items = [
  item('lab', iso('2026-11-25', '23:59'), { estimateMinutes: 120 }),
  item('proj', iso('2026-12-10', '23:59'), { estimateMinutes: 360 }),
  item('quiz', iso('2026-11-26', '10:00'), { courseId: 'math', estimateMinutes: 60 }),
  item('late', iso('2026-11-15', '23:59')), // overdue, not done, within 14 days
  item('ancient', iso('2026-10-01', '23:59')), // overdue but too old
  item('far', iso('2027-03-01', '23:59')), // beyond 8 weeks
  item('finished', iso('2026-11-24', '23:59'), { done: true }),
  item('loose', iso('2026-11-27', '23:59'), { courseId: undefined }),
  item('event', iso('2026-11-25', '10:00'), { kind: 'event' }),
  item('ancientCourse', iso('2026-10-01', '23:59'), { courseId: 'old', done: true }),
]
const blocks = [
  block('b1', 'lab', '2026-11-20', '10:00', '11:00'), // past
  block('b2', 'lab', '2026-11-22', '10:00', '11:00'),
  block('b3', 'finished', '2026-11-22', '12:00', '13:00'),
]
const lecture: Commitment = {
  id: 'lec', title: 'CS 210 lecture', type: 'class', courseId: 'cs', date: '2026-11-16',
  startTime: '10:00', endTime: '11:00', weekly: { days: [1, 3, 5] },
}
const ended: Commitment = { ...lecture, id: 'ended', title: 'Summer class', weekly: { days: [1], until: '2026-08-01' } }
const shift: Commitment = { ...lecture, id: 'work', title: 'Work', type: 'work', courseId: undefined }

const build = (filters: Partial<MapFilters> = {}) =>
  buildGraph({ items, courses, blocks, commitments: [lecture, ended, shift], now, filters: { ...DEFAULT_MAP_FILTERS, ...filters } })
const ids = (g: ReturnType<typeof build>) => g.nodes.map((n) => n.id).sort()
const node = (g: ReturnType<typeof build>, id: string) => g.nodes.find((n) => n.id === id)!

describe('buildGraph', () => {
  it('shows upcoming coursework and recent overdue work, linked to courses', () => {
    const g = build()
    expect(ids(g)).toEqual(
      ['block:b1', 'block:b2', 'course:cs', 'course:math', 'item:lab', 'item:late', 'item:loose', 'item:proj', 'item:quiz'].sort(),
    )
    expect(g.links).toContainEqual({ source: 'item:lab', target: 'course:cs' })
    expect(g.links).toContainEqual({ source: 'block:b2', target: 'item:lab' })
    expect(g.links.some((l) => l.source === 'item:loose')).toBe(false) // no course, no hub
  })

  it('marks overdue, short, and past, and sizes dots by estimate', () => {
    const g = build()
    expect(node(g, 'item:late').status).toBe('overdue')
    expect(node(g, 'item:proj').status).toBe('short') // 6 h with nothing planned
    expect(node(g, 'item:lab').status).toBeUndefined() // 2 h estimate, 2 h of blocks
    expect(node(g, 'block:b1').status).toBe('past')
    expect(node(g, 'item:proj').radius).toBeGreaterThan(node(g, 'item:quiz').radius)
    expect(node(g, 'course:cs')).toMatchObject({ radius: 8, color: '#8b7cf6', label: 'CS 210' })
    expect(node(g, 'block:b2').radius).toBe(2.5)
    expect(node(g, 'item:quiz').radius).toBeCloseTo(4.9, 1) // 1 h
    expect(node(g, 'item:proj').radius).toBe(6) // 6 h, capped
    // Short assignments say how much time is still missing (for the "Needs …" tag).
    expect(node(g, 'item:proj').needMinutes).toBe(360)
    expect(node(g, 'item:lab').needMinutes).toBeUndefined()
    expect(node(g, 'item:loose').color).toBe(DEFAULT_EVENT_COLOR)
  })

  it('shows finished work, faded, only when asked', () => {
    const g = build({ hideFinished: false })
    expect(node(g, 'item:finished').status).toBe('done')
    expect(node(g, 'block:b3')).toBeDefined()
    expect(ids(g)).not.toContain('item:ancientCourse')
    expect(ids(g)).not.toContain('course:old')
  })

  it('hiding a course removes its whole cluster', () => {
    const g = build({ hiddenCourses: ['cs'], showClasses: true })
    expect(ids(g).some((id) => ['course:cs', 'item:lab', 'block:b2', 'class:lec'].includes(id))).toBe(false)
    expect(ids(g)).toContain('item:quiz')
    // Hidden courses still appear as filter choices.
    expect(g.availableCourses.map((c) => c.id)).toEqual(['cs', 'math'])
  })

  it('adds class commitments with upcoming dates when classes are shown', () => {
    expect(ids(build())).not.toContain('class:lec')
    const g = build({ showClasses: true })
    expect(node(g, 'class:lec')).toMatchObject({ kind: 'class', label: 'CS 210 lecture', radius: 4 })
    expect(g.links).toContainEqual({ source: 'class:lec', target: 'course:cs' })
    expect(ids(g)).not.toContain('class:ended')
    expect(ids(g)).not.toContain('class:work') // only classes, not shifts
  })

  it('is empty when there is nothing coming up', () => {
    const g = buildGraph({ items: [], courses, blocks: [], commitments: [], now, filters: DEFAULT_MAP_FILTERS })
    expect(g).toEqual({ nodes: [], links: [], availableCourses: [] })
  })
})

describe('ringDistance', () => {
  it('places overdue work right next to its course', () => {
    expect(ringDistance(-2)).toBe(34)
  })

  it('marks the week rings at 7 and 14 days', () => {
    expect(ringDistance(0)).toBe(46)
    expect(ringDistance(7)).toBe(109)
    expect(ringDistance(14)).toBe(172)
  })

  it('squeezes later work into a narrow outer band, capped at 8 weeks', () => {
    expect(ringDistance(56)).toBeCloseTo(239.2, 5)
    expect(ringDistance(120)).toBe(ringDistance(56))
  })

  it('keeps sooner work closer, day by day', () => {
    for (let d = 0; d < 56; d += 0.5) expect(ringDistance(d + 0.5)).toBeGreaterThan(ringDistance(d))
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

describe('buildGraph due distance', () => {
  const g = buildGraph({ items, courses, blocks, commitments: [], now, filters: DEFAULT_MAP_FILTERS })
  const node = (id: string) => g.nodes.find((n) => n.id === id)

  it('gives assignments their days until due, negative when overdue', () => {
    expect(node('item:late')?.dueInDays).toBeLessThan(0)
    expect(node('item:lab')?.dueInDays).toBeCloseTo(4.5, 1)
  })

  it('leaves study blocks without a due distance', () => {
    expect(node('block:b2')?.dueInDays).toBeUndefined()
  })
})
