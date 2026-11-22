import { addDays, itemDateKey, localDateKey } from '../calendar/dates'
import type { CalendarItem } from '../db/db'
import { dueInstant } from '../study/plan'
import { mondayOf, type Unit, type Week } from './units'

const DAY_MS = 86_400_000

function dayNumber(key: string): number {
  const [y, m, d] = key.split('-').map(Number)
  return Date.UTC(y, m - 1, d) / DAY_MS
}

/** 'Oct 19' from a `YYYY-MM-DD` key, whatever the machine's locale. */
function shortDate(key: string): string {
  return new Date(key + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

/** How far away a due time is, by calendar day in the local time zone. */
export function countdown(due: number, now: Date): string {
  const days = dayNumber(localDateKey(new Date(due))) - dayNumber(localDateKey(now))
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days === -1) return 'yesterday'
  return days > 0 ? `in ${days} days` : `${-days} days ago`
}

/** One line saying what a test covers. */
export function coverLine(unit: Unit): string {
  if (unit.cumulative) return 'Covers the whole semester'
  const { previous, weeks } = unit
  if (weeks.length === 0) {
    return previous ? `Nothing due between ${previous.title} and this test` : 'Nothing due before this test'
  }
  if (!previous && unit.earliestKnown) {
    return `Covers everything since ${shortDate(unit.earliestKnown)}, the earliest work Praedus has for this class`
  }
  const first = weeks[0]
  const last = weeks[weeks.length - 1]
  const span =
    first.number !== undefined && last.number !== undefined
      ? `weeks ${first.number} to ${last.number}`
      : `${shortDate(first.start)} to ${shortDate(addDays(last.start, 6))}`
  return `Covers ${span}, since ${previous ? previous.title : 'the start of term'}`
}

export function weekHeading(week: Week): string {
  return week.number !== undefined ? `Week ${week.number}` : `Week of ${shortDate(week.start)}`
}

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: ' ',
  lt: '<',
  gt: '>',
  quot: '"',
  amp: '&',
  ndash: '\u2013',
  mdash: '\u2014',
  lsquo: '\u2018',
  rsquo: '\u2019',
  ldquo: '\u201C',
  rdquo: '\u201D',
  hellip: '\u2026',
}

/** Decodes numeric and common named HTML entities in one pass (so `&amp;ndash;` stays `&ndash;`). */
function decodeEntities(text: string): string {
  return text.replace(/&(#[xX][0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (match, body: string) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10)
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match
    }
    return NAMED_ENTITIES[body] ?? match
  })
}

/** A Canvas description as plain text, cut at a word boundary. */
export function plainDescription(text: string | undefined, max = 140): string {
  if (!text) return ''
  const plain = decodeEntities(text.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
  if (plain.length <= max) return plain
  const cut = plain.slice(0, max)
  // If the next character is a space, the cut already ends on a whole word.
  const space = plain[max] === ' ' ? max : cut.lastIndexOf(' ')
  return (space > 0 ? cut.slice(0, space) : cut).replace(/[\s.,;:]+$/, '') + '\u2026'
}

export type StudySetTopic = { id: string; title: string; hint: string }

/** The starting topics for a study set: each covered assignment, in due order, with a short plain hint. */
export function studySetTopics(unit: Unit): StudySetTopic[] {
  return [...unit.items]
    .sort((a: CalendarItem, b: CalendarItem) => dueInstant(a) - dueInstant(b))
    .map((i) => ({ id: i.id, title: i.title, hint: plainDescription(i.description, 80) }))
}

/** One week of a study set: its heading and what was due, with short plain hints. */
export type StudyWeek = { weekId: string; label: string; start?: string; items: { title: string; hint: string }[] }

/** The weeks a test covers, each with the work due that week; weeks with nothing due are left out. */
export function studyWeeks(unit: Unit): StudyWeek[] {
  return unit.weeks
    .map((w) => ({
      weekId: w.start,
      label: weekHeading(w),
      start: w.start,
      items: unit.items
        .filter((i) => mondayOf(itemDateKey(i)) === w.start)
        .sort((a, b) => dueInstant(a) - dueInstant(b))
        .map((i) => ({ title: i.title, hint: plainDescription(i.description, 80) })),
    }))
    .filter((w) => w.items.length > 0)
}
