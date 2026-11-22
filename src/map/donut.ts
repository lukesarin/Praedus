import { addDays, itemDateKey, localDateKey } from '../calendar/dates'
import { localInstant } from '../commitments/expand'
import type { CalendarItem, Course } from '../db/db'
import { dueInstant } from '../study/plan'
import { isTest } from '../study/testItems'
import { classWeeks, mapItems, mondayOf, testsOf, unitFor, type Unit, type Week } from './units'

/** Most dots drawn in one week's slice; the rest are counted in `more`. */
export const MAX_DOTS = 5

export type DonutDot = { item: CalendarItem; status?: 'done' | 'late'; reviewed: boolean }
export type DonutWeek = {
  week: Week
  /** "9" or "Oct 19". */
  label: string
  /** Radians, 0 = twelve o'clock, clockwise; the gap is already applied. */
  a0: number
  a1: number
  inUnit: boolean
  now: boolean
  /** At most MAX_DOTS, in due order. */
  dots: DonutDot[]
  /** Items beyond MAX_DOTS. */
  more: number
}
export type DonutTest = { item: CalendarItem; angle: number; picked: boolean; past: boolean; lane: 0 | 1 }
export type Donut = { weeks: DonutWeek[]; tests: DonutTest[]; unit?: Unit }

const TAU = Math.PI * 2
const LANE_CLOSE = 0.12

/** Past its due time. All-day work stays on time until its due day has ended. */
export function isLate(item: CalendarItem, now: Date): boolean {
  if (item.allDay) return itemDateKey(item) < localDateKey(now)
  return dueInstant(item) < now.getTime()
}

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

/** The slice for week `index` of `count` equal slices, starting at twelve o'clock. The gap shrinks so a slice never vanishes. */
export function sliceAngles(index: number, count: number, gap = 0.012): [number, number] {
  const width = TAU / count
  const g = Math.min(gap, width / 4)
  return [index * width + g, (index + 1) * width - g]
}

/** Within LANE_CLOSE radians of each other, going either way round the circle. */
function close(a: number, b: number): boolean {
  const d = Math.abs(a - b)
  return Math.min(d, TAU - d) < LANE_CLOSE
}

type Input ={ course: Course; items: CalendarItem[]; termStart?: string; testId?: string; now: Date }

/** One class as a donut: its weeks as equal slices, each week's work as dots, its tests placed on the rim. */
export function buildDonut({ course, items, termStart, testId, now }: Input): Donut {
  const classItems = mapItems(items.filter((i) => i.courseId === course.id))
  const weeks = classWeeks(classItems, termStart)
  const weekIndex = new Map(weeks.map((w, i) => [w.start, i]))
  // Only tests in the weeks the map shows can be picked.
  const tests = testsOf(classItems).filter((t) => weekIndex.has(mondayOf(itemDateKey(t))))
  const testIds = new Set(tests.map((t) => t.id))
  // A collapsed-away duplicate resolves to the test that was kept.
  const given = testId ? classItems.find((i) => i.id === testId && isTest(i)) : undefined
  const resolved = given ? unitFor(given, classItems, weeks, termStart) : undefined
  const unit = resolved && testIds.has(resolved.test.id) ? resolved : undefined
  const unitWeeks = new Set(unit?.weeks.map((w) => w.start))
  const currentWeek = mondayOf(localDateKey(now))

  const donutWeeks: DonutWeek[] = weeks.map((w, i) => {
    const [a0, a1] = sliceAngles(i, weeks.length)
    const work = classItems
      .filter((it) => !isTest(it) && mondayOf(itemDateKey(it)) === w.start)
      .sort((a, b) => dueInstant(a) - dueInstant(b))
    const dots: DonutDot[] = work.slice(0, MAX_DOTS).map((it) => {
      const status = it.done ? 'done' : isLate(it, now) ? 'late' : undefined
      return { item: it, ...(status ? { status } : {}), reviewed: !!it.reviewed }
    })
    return {
      week: w,
      label: w.number !== undefined ? String(w.number) : dateLabel(w.start),
      a0,
      a1,
      inUnit: unitWeeks.has(w.start),
      now: w.start === currentWeek,
      dots,
      more: Math.max(0, work.length - MAX_DOTS),
    }
  })

  const donutTests: DonutTest[] = []
  for (const t of tests) {
    const start = mondayOf(itemDateKey(t))
    const dw = donutWeeks[weekIndex.get(start)!]
    const from = localInstant(start, '00:00').getTime()
    const to = localInstant(addDays(start, 7), '00:00').getTime()
    const fraction = Math.min(1, Math.max(0, (dueInstant(t) - from) / (to - from)))
    const angle = dw.a0 + fraction * (dw.a1 - dw.a0)
    const prev = donutTests[donutTests.length - 1]
    // A test close to the one before it takes the other lane, so labels in a cluster alternate.
    const lane: 0 | 1 = prev && close(angle, prev.angle) ? (prev.lane === 0 ? 1 : 0) : 0
    donutTests.push({ item: t, angle, picked: unit?.test.id === t.id, past: dueInstant(t) < now.getTime(), lane })
  }
  // The rim is a circle: the last test can sit right beside the first.
  const first = donutTests[0]
  const last = donutTests[donutTests.length - 1]
  const beforeLast = donutTests[donutTests.length - 2]
  if (donutTests.length > 2 && !close(last.angle, beforeLast.angle) && close(last.angle, first.angle) && last.lane === first.lane) {
    last.lane = last.lane === 0 ? 1 : 0
  }

  return { weeks: donutWeeks, tests: donutTests, ...(unit ? { unit } : {}) }
}
