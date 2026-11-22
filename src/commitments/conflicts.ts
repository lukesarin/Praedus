import type { CalendarItem } from '../db/db'
import type { Occurrence } from './types'

/** How far ahead conflicts are checked. */
export const CONFLICT_WINDOW_DAYS = 56

export type Conflict =
  | { id: string; kind: 'overlap'; a: Occurrence; b: Occurrence; at: string }
  | { id: string; kind: 'deadline'; occurrence: Occurrence; item: CalendarItem; at: string }
  | { id: string; kind: 'tight'; a: Occurrence; b: Occurrence; gapMinutes: number; at: string }

const MINUTE = 60_000

/**
 * Red conflicts: commitments that overlap, or a timed deadline strictly inside a commitment.
 * Amber "tight" warnings: commitments less than `minGapMinutes` apart (touching counts).
 * Everything from the start of today counts (so today's schedule is checked even after
 * parts of it have passed). Earlier days don't. Imported Canvas events never count.
 */
export function findConflicts(
  occs: Occurrence[],
  items: CalendarItem[],
  opts: { now: Date; minGapMinutes: number },
): Conflict[] {
  const n = opts.now
  const startOfToday = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime()
  const gap = Math.max(0, opts.minGapMinutes) * MINUTE
  const upcoming = occs
    .filter((o) => Date.parse(o.end) > startOfToday)
    .sort((x, y) => x.start.localeCompare(y.start))
  const out: Conflict[] = []

  for (let i = 0; i < upcoming.length; i++) {
    const a = upcoming[i]
    const aEnd = Date.parse(a.end)
    for (let j = i + 1; j < upcoming.length; j++) {
      const b = upcoming[j]
      const bStart = Date.parse(b.start)
      if (bStart >= aEnd + gap) break // sorted by start, so nothing later can be close
      if (bStart < aEnd) {
        out.push({ id: `overlap:${a.id}|${b.id}`, kind: 'overlap', a, b, at: b.start })
      } else {
        out.push({
          id: `tight:${a.id}|${b.id}`,
          kind: 'tight',
          a,
          b,
          gapMinutes: Math.round((bStart - aEnd) / MINUTE),
          at: a.end,
        })
      }
    }
  }

  const deadlines = items.filter(
    (i) => i.kind === 'assignment' && !i.keptAsHistory && !i.allDay && !i.done && Date.parse(i.start) >= startOfToday,
  )
  for (const item of deadlines) {
    const due = Date.parse(item.start)
    for (const o of upcoming) {
      if (Date.parse(o.start) < due && due < Date.parse(o.end)) {
        out.push({ id: `deadline:${o.id}|${item.id}`, kind: 'deadline', occurrence: o, item, at: item.start })
      }
    }
  }

  return out.sort((x, y) => x.at.localeCompare(y.at))
}

/** Ids of occurrences and items to outline in red or amber. Red wins. */
export function conflictMarks(cs: Conflict[]): { red: Set<string>; amber: Set<string> } {
  const red = new Set<string>()
  const amber = new Set<string>()
  for (const c of cs) {
    if (c.kind === 'overlap') red.add(c.a.id).add(c.b.id)
    else if (c.kind === 'deadline') red.add(c.occurrence.id).add(c.item.id)
  }
  for (const c of cs) {
    if (c.kind !== 'tight') continue
    for (const id of [c.a.id, c.b.id]) if (!red.has(id)) amber.add(id)
  }
  return { red, amber }
}
