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
