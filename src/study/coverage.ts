import type { CalendarItem } from '../db/db'
import { dueInstant, estimateFor } from './plan'
import { plannableItems } from './testItems'
import type { StudyBlock } from './types'

export type Coverage = {
  item: CalendarItem
  /** Minutes */
  estimate: number
  /** In blocks that have already ended. */
  studied: number
  /** In blocks still to come (including one in progress). */
  planned: number
  short: number
}

/** How much study time each upcoming, unfinished assignment has, soonest due first. */
export function coverage(items: CalendarItem[], blocks: StudyBlock[], now: Date): Coverage[] {
  const nowMs = now.getTime()
  return plannableItems(items)
    .filter((i) => !i.done && dueInstant(i) > nowMs)
    .sort((a, b) => dueInstant(a) - dueInstant(b))
    .map((item) => {
      let studied = 0
      let planned = 0
      for (const b of blocks) {
        if (b.itemId !== item.id) continue
        const mins = (Date.parse(b.end) - Date.parse(b.start)) / 60000
        if (Date.parse(b.end) <= nowMs) studied += mins
        else planned += mins
      }
      const estimate = estimateFor(item)
      return { item, estimate, studied, planned, short: Math.max(0, estimate - studied - planned) }
    })
}
