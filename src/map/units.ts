import type { CalendarItem, Course } from '../db/db'
import { addDays, itemDateKey } from '../calendar/dates'
import { dueInstant } from '../study/plan'
import { isFinal, isTest } from '../study/testItems'

export const MAX_WEEKS = 20

export type Week = { start: string; number?: number }
export type Unit = {
  test: CalendarItem
  previous?: CalendarItem
  weeks: Week[]
  items: CalendarItem[]
  cumulative: boolean
  earliestKnown?: string
}

const DAY_MS = 86_400_000

function dayNumber(key: string): number {
  const [y, m, d] = key.split('-').map(Number)
  return Date.UTC(y, m - 1, d) / DAY_MS
}

/** The Monday on or before a `YYYY-MM-DD` key. */
export function mondayOf(dateKey: string): string {
  const sinceMonday = (new Date(dayNumber(dateKey) * DAY_MS).getUTCDay() + 6) % 7
  return addDays(dateKey, -sinceMonday)
}

const weekOf = (item: CalendarItem) => mondayOf(itemDateKey(item))

/** Monday-to-Sunday weeks from the first day of classes (or the earliest item) to the latest item. */
export function classWeeks(classItems: CalendarItem[], termStart?: string): Week[] {
  const first = termStart ? mondayOf(termStart) : undefined
  const mondays = classItems.map(weekOf).filter((w) => !first || w >= first)
  if (mondays.length === 0) return []
  const sorted = [...mondays].sort()
  const from = first ?? sorted[0]
  const last = sorted[sorted.length - 1]
  const weeks: Week[] = []
  for (let start = from; start <= last; start = addDays(start, 7)) {
    weeks.push(first ? { start, number: 1 + Math.round((dayNumber(start) - dayNumber(first)) / 7) } : { start })
  }
  return weeks.slice(-MAX_WEEKS)
}

/** The class's tests by due time. An assignment and an event with the same title on one day count once, as the event. */
export function testsOf(classItems: CalendarItem[]): CalendarItem[] {
  const tests = classItems.filter(isTest)
  const sig = (i: CalendarItem) => `${i.title.trim().toLowerCase()}|${itemDateKey(i)}`
  const eventSigs = new Set(tests.filter((i) => i.kind === 'event').map(sig))
  return tests
    .filter((i) => i.kind === 'event' || !eventSigs.has(sig(i)))
    .sort((a, b) => dueInstant(a) - dueInstant(b))
}

export function unitFor(test: CalendarItem, classItems: CalendarItem[], weeks: Week[], termStart?: string): Unit {
  const cumulative = isFinal(test)
  const tests = testsOf(classItems)
  const idx = tests.findIndex((t) => t.id === test.id)
  const previous = idx > 0 ? tests[idx - 1] : undefined
  const testWeek = weekOf(test)
  const after = !cumulative && previous ? weekOf(previous) : undefined
  const unitWeeks = weeks.filter((w) => w.start < testWeek && (after === undefined || w.start > after))
  const inUnit = new Set(unitWeeks.map((w) => w.start))
  const items = classItems
    .filter((i) => i.kind === 'assignment' && !isTest(i) && inUnit.has(weekOf(i)))
    .sort((a, b) => dueInstant(a) - dueInstant(b))

  // The unit may start before the app's history when nothing earlier bounds it.
  const startsOpen = cumulative || !previous
  const earliest = classItems.length ? classItems.map(itemDateKey).sort()[0] : undefined
  let earliestKnown: string | undefined
  if (earliest && startsOpen) {
    if (!termStart) earliestKnown = earliest
    else if (earliest > (unitWeeks[0]?.start ?? mondayOf(termStart))) earliestKnown = earliest
  }
  return { test, previous, weeks: unitWeeks, items, cumulative, ...(earliestKnown ? { earliestKnown } : {}) }
}

export function defaultPick(
  courses: Course[],
  items: CalendarItem[],
  now: Date,
): { courseId: string; testId?: string } | null {
  const ids = new Set(courses.map((c) => c.id))
  const mine = items.filter((i) => i.courseId && ids.has(i.courseId))
  const upcoming = mine
    .filter((i) => isTest(i) && dueInstant(i) > now.getTime())
    .sort((a, b) => dueInstant(a) - dueInstant(b))[0]
  if (upcoming) return { courseId: upcoming.courseId!, testId: upcoming.id }
  const first = [...courses]
    .sort((a, b) => a.name.localeCompare(b.name))
    .find((c) => mine.some((i) => i.courseId === c.id))
  if (!first) return null
  const tests = testsOf(mine.filter((i) => i.courseId === first.id))
  const latest = tests[tests.length - 1]
  return latest ? { courseId: first.id, testId: latest.id } : { courseId: first.id }
}
