import { addDays, formatDue, localDateKey } from '../calendar/dates'
import { DEFAULT_EVENT_COLOR } from '../calendar/toEvents'
import { localInstant } from '../commitments/expand'
import { describeCommitment } from '../commitments/format'
import { nextOccurrence } from '../commitments/order'
import type { Commitment } from '../commitments/types'
import type { CalendarItem, Course } from '../db/db'
import { coverage } from '../study/coverage'
import { dueInstant, estimateFor } from '../study/plan'
import type { StudyBlock } from '../study/types'

export type MapFilters = { hiddenCourses: string[]; hideFinished: boolean; showClasses: boolean }
export const DEFAULT_MAP_FILTERS: MapFilters = { hiddenCourses: [], hideFinished: true, showClasses: false }

export type NodeKind = 'course' | 'assignment' | 'block' | 'class'
export type NodeStatus = 'overdue' | 'short' | 'done' | 'past'

export type MapNode = {
  /** `course:<id>`, `item:<id>`, `block:<id>`, `class:<id>` */
  id: string
  kind: NodeKind
  /** The id of the underlying course, item, block, or commitment. */
  refId: string
  label: string
  color: string
  radius: number
  status?: NodeStatus
  /** For short assignments: study time still missing (minutes). */
  needMinutes?: number
  /** Shown on hover, e.g. "Due Wed, Nov 25 · 11:59 PM". */
  detail?: string
  /** Assignments only: days from now until due (negative when overdue). Sets distance from the course. */
  dueInDays?: number
}

export type MapLink = { source: string; target: string }

/** Upcoming window, matching conflicts and planning. */
export const MAP_WINDOW_DAYS = 56
/** Unfinished work this overdue still shows (in red). */
export const OVERDUE_DAYS = 14

const RADIUS = { course: 8, class: 4, block: 2.5 }

/** Distance of the "This week" and "Next week" guide rings from a course's center. */
export const RING_THIS_WEEK = 109
export const RING_NEXT_WEEK = 172

/**
 * How far an assignment sits from its course: sooner is closer. The first two weeks are
 * spread evenly (one ring each); later work, up to 8 weeks out, is squeezed into a narrow band.
 */
export function ringDistance(days: number): number {
  if (days < 0) return 34
  if (days <= 14) return 46 + 9 * days
  return RING_NEXT_WEEK + 1.6 * (Math.min(days, MAP_WINDOW_DAYS) - 14)
}

/** "CS 210 Intro to Programming" → "CS 210". Names without a code are kept, shortened to 16 characters. */
export function courseCode(name: string): string {
  const m = /^([A-Za-z]{2,6})[\s-]*(\d{2,4}[A-Za-z]?)\b/.exec(name.trim())
  if (m) return `${m[1]} ${m[2]}`
  return name.length > 16 ? `${name.slice(0, 15).trimEnd()}…` : name
}

export function assignmentRadius(estimateMinutes: number): number {
  return Math.min(6, Math.max(4, 4 + 0.9 * Math.sqrt(estimateMinutes / 60)))
}

const time = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

type Input = {
  items: CalendarItem[]
  courses: Course[]
  blocks: StudyBlock[]
  commitments: Commitment[]
  now: Date
  filters: MapFilters
}

/** Decides which dots and lines the study map shows, and how each one looks. */
export function buildGraph({ items, courses, blocks, commitments, now, filters }: Input): {
  nodes: MapNode[]
  links: MapLink[]
  availableCourses: Course[]
} {
  const today = localDateKey(now)
  const startOfToday = localInstant(today, '00:00').getTime()
  const windowEnd = localInstant(addDays(today, MAP_WINDOW_DAYS + 1), '00:00').getTime()
  const overdueFrom = localInstant(addDays(today, -OVERDUE_DAYS), '00:00').getTime()
  const nowMs = now.getTime()
  const hidden = new Set(filters.hiddenCourses)
  const courseById = new Map(courses.map((c) => [c.id, c]))
  const colorOf = (courseId?: string) => (courseId && courseById.get(courseId)?.color) || DEFAULT_EVENT_COLOR

  // Everything in the window, before filters (used for the course chips too).
  const inWindow = items.filter((i) => {
    if (i.kind !== 'assignment') return false
    const due = dueInstant(i)
    if (due >= windowEnd) return false
    if (due >= startOfToday) return true
    return !i.done && due >= overdueFrom
  })
  const upcomingClasses = commitments.filter((c) => {
    if (c.type !== 'class') return false
    const next = nextOccurrence(c, now)
    return next !== undefined && Date.parse(next.start) < windowEnd
  })

  const availableIds = new Set<string>()
  for (const i of inWindow) if (i.courseId) availableIds.add(i.courseId)
  if (filters.showClasses) for (const c of upcomingClasses) if (c.courseId) availableIds.add(c.courseId)
  const availableCourses = courses
    .filter((c) => availableIds.has(c.id))
    .sort((a, b) => a.name.localeCompare(b.name))

  const visible = (courseId?: string) => !courseId || !hidden.has(courseId)
  const shown = inWindow.filter((i) => visible(i.courseId) && !(filters.hideFinished && i.done))
  const short = new Map(coverage(shown, blocks, now).map((c) => [c.item.id, c.short]))

  const nodes: MapNode[] = []
  const links: MapLink[] = []
  const usedCourses = new Set<string>()

  for (const i of shown) {
    const overdue = !i.done && dueInstant(i) <= nowMs
    const status: NodeStatus | undefined = i.done
      ? 'done'
      : overdue
        ? 'overdue'
        : (short.get(i.id) ?? 0) > 0
          ? 'short'
          : undefined
    nodes.push({
      id: `item:${i.id}`,
      kind: 'assignment',
      refId: i.id,
      label: i.title,
      color: colorOf(i.courseId),
      radius: assignmentRadius(estimateFor(i)),
      ...(status ? { status } : {}),
      ...(status === 'short' ? { needMinutes: short.get(i.id) } : {}),
      detail: `Due ${formatDue(i)}`,
      dueInDays: (dueInstant(i) - nowMs) / 86_400_000,
    })
    if (i.courseId && courseById.has(i.courseId)) {
      links.push({ source: `item:${i.id}`, target: `course:${i.courseId}` })
      usedCourses.add(i.courseId)
    }
  }

  const shownIds = new Map(shown.map((i) => [i.id, i]))
  for (const b of blocks) {
    const i = shownIds.get(b.itemId)
    if (!i) continue
    const day = new Date(b.start).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
    nodes.push({
      id: `block:${b.id}`,
      kind: 'block',
      refId: b.id,
      label: i.title,
      color: colorOf(i.courseId),
      radius: RADIUS.block,
      ...(Date.parse(b.end) <= nowMs || i.done ? { status: 'past' as const } : {}),
      detail: `${day} · ${time(b.start)} – ${time(b.end)}`,
    })
    links.push({ source: `block:${b.id}`, target: `item:${i.id}` })
  }

  if (filters.showClasses) {
    for (const c of upcomingClasses) {
      if (!visible(c.courseId)) continue
      nodes.push({
        id: `class:${c.id}`,
        kind: 'class',
        refId: c.id,
        label: c.title,
        color: colorOf(c.courseId),
        radius: RADIUS.class,
        detail: describeCommitment(c),
      })
      if (c.courseId && courseById.has(c.courseId)) {
        links.push({ source: `class:${c.id}`, target: `course:${c.courseId}` })
        usedCourses.add(c.courseId)
      }
    }
  }

  for (const id of usedCourses) {
    const c = courseById.get(id)!
    nodes.unshift({ id: `course:${id}`, kind: 'course', refId: id, label: c.name, color: c.color, radius: RADIUS.course })
  }

  return { nodes, links, availableCourses }
}
