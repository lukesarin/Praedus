import type { CalendarItem, Course } from '../db/db'
import { addDays, itemDateKey } from '../calendar/dates'
import { dueInstant } from '../study/plan'
import { duplicateTestIds, isFinal, isTest } from '../study/testItems'

export const MAX_WEEKS = 20

export type Week = { start: string; number?: number }
export type Unit = {
  test: CalendarItem
  previous?: CalendarItem
  weeks: Week[]
  items: CalendarItem[]
  cumulative: boolean
  /**
   * Date key of the class's earliest item. Set only when the unit has no earlier test to bound it
   * (no `previous`, or a final, which is cumulative and starts at the first known week) and the
   * app's history may not reach back that far: no `termStart`, or the earliest item falls after
   * the unit's first week.
   */
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
  const last = sorted[sorted.length - 1]
  // Only the most recent MAX_WEEKS can be shown, so never walk further back than that.
  const earliest = addDays(last, -(MAX_WEEKS - 1) * 7)
  const from = (first ?? sorted[0]) < earliest ? earliest : (first ?? sorted[0])
  const weeks: Week[] = []
  for (let start = from; start <= last; start = addDays(start, 7)) {
    weeks.push(first ? { start, number: 1 + Math.round((dayNumber(start) - dayNumber(first)) / 7) } : { start })
  }
  return weeks
}

const sig = (i: CalendarItem) => `${i.title.trim().toLowerCase()}|${itemDateKey(i)}`

/** The class's tests by due time. An assignment and an event with the same title on one day count once, as the event. */
export function testsOf(classItems: CalendarItem[]): CalendarItem[] {
  const dupes = duplicateTestIds(classItems)
  return classItems
    .filter((i) => isTest(i) && !dupes.has(i.id))
    .sort((a, b) => dueInstant(a) - dueInstant(b))
}

/** What the map draws for a class: its assignments and its tests (not other events). */
export function mapItems(classItems: CalendarItem[]): CalendarItem[] {
  return classItems.filter((i) => i.kind === 'assignment' || (i.kind === 'event' && isTest(i)))
}

/** The class's tests that fall in the weeks the map shows (from the first day of classes, at most MAX_WEEKS). */
export function visibleTests(classItems: CalendarItem[], termStart?: string): CalendarItem[] {
  const shown = mapItems(classItems)
  const starts = new Set(classWeeks(shown, termStart).map((w) => w.start))
  return testsOf(shown).filter((t) => starts.has(weekOf(t)))
}

export function unitFor(given: CalendarItem, classItems: CalendarItem[], weeks: Week[], termStart?: string): Unit {
  const tests = testsOf(classItems)
  // A collapsed-away duplicate resolves to the test testsOf kept.
  const idx = tests.findIndex((t) => t.id === given.id || sig(t) === sig(given))
  const test = idx >= 0 ? tests[idx] : given
  const cumulative = isFinal(test)
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
    // By week: an item anywhere in the unit's first week means that week is on record.
    else if (mondayOf(earliest) > (unitWeeks[0]?.start ?? mondayOf(termStart))) earliestKnown = earliest
  }
  return { test, previous, weeks: unitWeeks, items, cumulative, ...(earliestKnown ? { earliestKnown } : {}) }
}

/** A class's test to start on: its next upcoming test, else its latest. Undefined when it has none. */
export function defaultTestFor(classItems: CalendarItem[], now: Date, termStart?: string): CalendarItem | undefined {
  const tests = visibleTests(classItems, termStart)
  return tests.find((t) => dueInstant(t) > now.getTime()) ?? tests[tests.length - 1]
}

export function defaultPick(
  courses: Course[],
  items: CalendarItem[],
  now: Date,
  termStart?: string,
): { courseId: string; testId?: string } | null {
  const ids = new Set(courses.map((c) => c.id))
  const mine = items.filter((i) => i.courseId && ids.has(i.courseId))
  const byCourse = new Map<string, CalendarItem[]>()
  for (const i of mine) byCourse.set(i.courseId!, [...(byCourse.get(i.courseId!) ?? []), i])
  let upcoming: CalendarItem | undefined
  for (const classItems of byCourse.values()) {
    const t = defaultTestFor(classItems, now, termStart)
    const next = t && dueInstant(t) > now.getTime() ? t : undefined
    if (next && (!upcoming || dueInstant(next) < dueInstant(upcoming))) upcoming = next
  }
  if (upcoming) return { courseId: upcoming.courseId!, testId: upcoming.id }
  const first = [...courses]
    .sort((a, b) => a.name.localeCompare(b.name))
    .find((c) => byCourse.has(c.id))
  if (!first) return null
  // No class has an upcoming test, so this is the class's latest.
  const latest = defaultTestFor(byCourse.get(first.id)!, now, termStart)
  return latest ? { courseId: first.id, testId: latest.id } : { courseId: first.id }
}
