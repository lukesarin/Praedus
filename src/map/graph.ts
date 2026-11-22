import { itemDateKey, localDateKey } from '../calendar/dates'
import type { CalendarItem, Course } from '../db/db'
import { dueInstant } from '../study/plan'
import { isTest } from '../study/testItems'
import { classWeeks, mondayOf, testsOf, unitFor, type Unit, type Week } from './units'

export type NodeKind = 'course' | 'week' | 'assignment' | 'test'

export type MapNode = {
  /** `course:<id>`, `week:<monday>`, `item:<id>` */
  id: string
  kind: NodeKind
  /** The course id, the week's Monday key, or the item id. */
  refId: string
  /** Course code, week label ("9" or "Oct 19"), or title. */
  label: string
  /** Monday key, for week, assignment and test nodes. */
  week?: string
  /** Inside the picked test's unit. */
  inUnit: boolean
  /** The picked test. */
  picked?: boolean
  /** The current week. */
  now?: boolean
  status?: 'done' | 'late'
  reviewed?: boolean
}

export type MapLink = { source: string; target: string; kind: 'spine' | 'spoke' | 'item' }

/** "CS 210 Intro to Programming" → "CS 210". Names without a code are kept, shortened to 16 characters. */
export function courseCode(name: string): string {
  const m = /^([A-Za-z]{2,6})[\s-]*(\d{2,4}[A-Za-z]?)\b/.exec(name.trim())
  if (m) return `${m[1]} ${m[2]}`
  return name.length > 16 ? `${name.slice(0, 15).trimEnd()}…` : name
}

/** "2026-10-19" → "Oct 19", independent of locale and time zone. */
function dateLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

type Input = { course: Course; items: CalendarItem[]; termStart?: string; testId?: string; now: Date }

/** One class as a graph: the course at the center, its weeks, and each week's assignments and tests. */
export function buildClassGraph({ course, items, termStart, testId, now }: Input): {
  nodes: MapNode[]
  links: MapLink[]
  weeks: Week[]
  tests: CalendarItem[]
  unit?: Unit
} {
  const classItems = items.filter(
    (i) => i.courseId === course.id && (i.kind === 'assignment' || (i.kind === 'event' && isTest(i))),
  )
  const weeks = classWeeks(classItems, termStart)
  const tests = testsOf(classItems)
  const testIds = new Set(tests.map((t) => t.id))
  // A collapsed-away duplicate resolves to the test that was kept.
  const given = testId ? classItems.find((i) => i.id === testId && isTest(i)) : undefined
  const unit = given ? unitFor(given, classItems, weeks, termStart) : undefined
  const picked = unit?.test
  const unitWeeks = new Set(unit?.weeks.map((w) => w.start))
  const unitItems = new Set(unit?.items.map((i) => i.id))
  const currentWeek = mondayOf(localDateKey(now))
  const nowMs = now.getTime()
  const weekStarts = new Set(weeks.map((w) => w.start))

  const courseId = `course:${course.id}`
  const nodes: MapNode[] = [{ id: courseId, kind: 'course', refId: course.id, label: courseCode(course.name), inUnit: false }]
  const links: MapLink[] = []

  weeks.forEach((w, idx) => {
    const id = `week:${w.start}`
    nodes.push({
      id,
      kind: 'week',
      refId: w.start,
      label: w.number !== undefined ? String(w.number) : dateLabel(w.start),
      week: w.start,
      inUnit: unitWeeks.has(w.start),
      ...(w.start === currentWeek ? { now: true } : {}),
    })
    links.push({ source: courseId, target: id, kind: 'spoke' })
    if (idx > 0) links.push({ source: `week:${weeks[idx - 1].start}`, target: id, kind: 'spine' })
  })

  for (const i of classItems) {
    const week = mondayOf(itemDateKey(i))
    if (!weekStarts.has(week)) continue
    const test = isTest(i)
    if (test && !testIds.has(i.id)) continue
    const status = i.done ? 'done' : !test && dueInstant(i) < nowMs ? 'late' : undefined
    const id = `item:${i.id}`
    nodes.push({
      id,
      kind: test ? 'test' : 'assignment',
      refId: i.id,
      label: i.title,
      week,
      inUnit: unitItems.has(i.id),
      ...(picked && i.id === picked.id ? { picked: true } : {}),
      ...(status ? { status } : {}),
      ...(i.reviewed ? { reviewed: true } : {}),
    })
    links.push({ source: `week:${week}`, target: id, kind: 'item' })
  }

  return { nodes, links, weeks, tests, ...(unit ? { unit } : {}) }
}
