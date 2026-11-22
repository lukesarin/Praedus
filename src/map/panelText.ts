import { addDays, localDateKey } from '../calendar/dates'
import type { Unit, Week } from './units'

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

/** A Canvas description as plain text, cut at a word boundary. */
export function plainDescription(text: string | undefined, max = 140): string {
  if (!text) return ''
  const plain = text
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
  if (plain.length <= max) return plain
  const cut = plain.slice(0, max)
  const space = cut.lastIndexOf(' ')
  return (space > 0 ? cut.slice(0, space) : cut).replace(/[\s.,;:]+$/, '') + '…'
}
