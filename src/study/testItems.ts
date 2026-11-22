import { itemDateKey } from '../calendar/dates'
import type { CalendarItem } from '../db/db'

type Titled = Pick<CalendarItem, 'kind' | 'title'>

const TEST = /\b(test|exam|midterm)\b/i
const NOT_A_TEST_EVENT = /\b(review|session|office hours|help)\b/i

/** A test, exam or midterm. Events that are really review sessions or help hours don't count. */
export function isTest(item: Titled): boolean {
  if (!TEST.test(item.title)) return false
  if (item.kind === 'event' && NOT_A_TEST_EVENT.test(item.title)) return false
  return true
}

export function isFinal(item: Titled): boolean {
  return isTest(item) && /\bfinal\b/i.test(item.title)
}

/** Study time is planned for assignments and for tests posted as events. */
export function isPlannable(item: Titled): boolean {
  return item.kind === 'assignment' || isTest(item)
}

const dupKey = (i: CalendarItem) => `${i.courseId ?? ''}|${i.title.trim().toLowerCase()}|${itemDateKey(i)}`

/**
 * Ids of assignments that are the same test as an event (same course, same title ignoring case,
 * same local day). The event is the one that counts. The one place this rule lives.
 */
export function duplicateTestIds(items: CalendarItem[]): Set<string> {
  const eventKeys = new Set(items.filter((i) => i.kind === 'event' && isTest(i)).map(dupKey))
  return new Set(items.filter((i) => i.kind === 'assignment' && isTest(i) && eventKeys.has(dupKey(i))).map((i) => i.id))
}

/** Items study time is planned for: plannable, not kept as history, without a test posted twice. */
export function plannableItems(items: CalendarItem[]): CalendarItem[] {
  const dupes = duplicateTestIds(items)
  return items.filter((i) => isPlannable(i) && !i.keptAsHistory && !dupes.has(i.id))
}
