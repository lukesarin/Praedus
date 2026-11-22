import { addDays, localDateKey } from '../calendar/dates'
import { localInstant } from '../commitments/expand'
import type { Occurrence } from '../commitments/types'
import type { CalendarItem } from '../db/db'
import { defaultEstimate } from './estimate'
import { isPlannable } from './testItems'
import { PLAN_HORIZON_DAYS, type StudyBlock, type StudySettings } from './types'

export type PlanInput = {
  items: CalendarItem[]
  occurrences: Occurrence[]
  blocks: StudyBlock[]
  settings: StudySettings
  now: Date
  newId?: () => string
}

export type PlanResult = {
  add: StudyBlock[]
  /** Ids of existing blocks to delete (the planner's own future blocks). */
  remove: string[]
  wontFit: { itemId: string; shortMinutes: number }[]
}

const MIN = 60_000
const GRID = 15 * MIN
const up = (ms: number) => Math.ceil(ms / GRID) * GRID
const down = (ms: number) => Math.floor(ms / GRID) * GRID

type Slot = { start: number; end: number }

/** All-day deadlines are due at the start of that day; timed ones at their time. */
export function dueInstant(item: Pick<CalendarItem, 'start' | 'allDay'>): number {
  return item.allDay ? localInstant(item.start.slice(0, 10), '00:00').getTime() : Date.parse(item.start)
}

export function estimateFor(item: Pick<CalendarItem, 'title' | 'estimateMinutes'>): number {
  return item.estimateMinutes ?? defaultEstimate(item.title)
}

function subtract(slots: Slot[], busy: Slot): Slot[] {
  const out: Slot[] = []
  for (const s of slots) {
    if (busy.end <= s.start || busy.start >= s.end) {
      out.push(s)
      continue
    }
    if (busy.start > s.start) out.push({ start: s.start, end: busy.start })
    if (busy.end < s.end) out.push({ start: busy.end, end: s.end })
  }
  return out
}

/**
 * Earliest deadline first. The first pass gives each day before the deadline one chunk
 * sized to spread the work evenly from today; later passes use full-size chunks to
 * catch up wherever there's still room. Never past the deadline, outside study hours,
 * over the daily limit, or on top of commitments (plus buffer) or kept blocks.
 */
export function planStudy(input: PlanInput): PlanResult {
  const { items, occurrences, blocks, settings, now } = input
  const newId = input.newId ?? (() => crypto.randomUUID())
  const nowMs = now.getTime()
  const startMs = up(nowMs)
  const today = localDateKey(now)
  const lastDay = addDays(today, PLAN_HORIZON_DAYS)
  const byId = new Map(items.map((i) => [i.id, i]))

  // 1. Decide which existing blocks stay.
  const kept: StudyBlock[] = []
  const remove: string[] = []
  for (const b of blocks) {
    const item = byId.get(b.itemId)
    const started = Date.parse(b.start) < nowMs
    if (!item) {
      if (b.pinned || started) kept.push(b)
      else remove.push(b.id)
    } else if (b.pinned || started || item.done) {
      kept.push(b)
    } else {
      remove.push(b.id)
    }
  }
  // Crossed-out blocks (finished work) don't take up time.
  const occupying = kept.filter((b) => !byId.get(b.itemId)?.done)

  // 2. Free slots per day.
  const buffer = settings.bufferMinutes * MIN
  const busy: Slot[] = [
    ...occurrences.map((o) => ({ start: Date.parse(o.start) - buffer, end: Date.parse(o.end) + buffer })),
    ...occupying.map((b) => ({ start: Date.parse(b.start), end: Date.parse(b.end) })),
  ]
  const days: string[] = []
  const slots = new Map<string, Slot[]>()
  const used = new Map<string, number>()
  for (let key = today; key <= lastDay; key = addDays(key, 1)) {
    days.push(key)
    const weekend = [0, 6].includes(localInstant(key, '12:00').getDay())
    const w = weekend ? settings.weekend : settings.weekday
    let free: Slot[] = [{ start: Math.max(localInstant(key, w.start).getTime(), startMs), end: localInstant(key, w.end).getTime() }]
    for (const b of busy) free = subtract(free, b)
    slots.set(
      key,
      free.map((s) => ({ start: up(s.start), end: down(s.end) })).filter((s) => s.end > s.start),
    )
    used.set(key, 0)
  }
  for (const b of occupying) {
    const key = localDateKey(new Date(b.start))
    if (used.has(key)) used.set(key, used.get(key)! + (Date.parse(b.end) - Date.parse(b.start)) / MIN)
  }

  // 3. Place chunks, earliest deadline first.
  const assignments = items
    .filter((i) => isPlannable(i) && !i.done && dueInstant(i) > nowMs)
    .sort((a, b) => dueInstant(a) - dueInstant(b) || a.title.localeCompare(b.title))
  const add: StudyBlock[] = []
  const wontFit: PlanResult['wontFit'] = []
  const limit = settings.dailyLimitMinutes

  for (const item of assignments) {
    const due = dueInstant(item)
    const already = kept
      .filter((b) => b.itemId === item.id)
      .reduce((sum, b) => sum + (Date.parse(b.end) - Date.parse(b.start)) / MIN, 0)
    let remaining = estimateFor(item) - already
    if (remaining <= 0) continue

    const window = days.filter((d) => localInstant(d, '00:00').getTime() < due)
    const usable = (d: string) => (slots.get(d) ?? []).map((s) => ({ start: s.start, end: Math.min(s.end, due) }))

    for (let pass = 0; pass < 20 && remaining > 0; pass++) {
      const open = window.filter((d) => limit - used.get(d)! >= 15 && usable(d).some((s) => s.end - s.start >= GRID))
      if (open.length === 0) break
      const target =
        pass === 0
          ? Math.min(settings.chunkMaxMinutes, Math.max(settings.chunkMinMinutes, Math.ceil(remaining / open.length / 15) * 15))
          : settings.chunkMaxMinutes
      let progress = false

      for (const d of open) {
        if (remaining <= 0) break
        const room = limit - used.get(d)!
        const daySlots = slots.get(d)!
        for (const slot of daySlots) {
          const end = Math.min(slot.end, due)
          const length = (end - slot.start) / MIN
          // A small leftover still gets a full minimum-length block (a few minutes over
          // the estimate beats a scrap of a block).
          const need = Math.max(Math.ceil(remaining / 15) * 15, settings.chunkMinMinutes)
          const want = Math.min(target, need, room)
          const chunk = Math.floor(Math.min(want, length) / 15) * 15
          if (chunk < settings.chunkMinMinutes) continue
          add.push({
            id: newId(),
            itemId: item.id,
            start: new Date(slot.start).toISOString(),
            end: new Date(slot.start + chunk * MIN).toISOString(),
            pinned: false,
          })
          slot.start += chunk * MIN
          used.set(d, used.get(d)! + chunk)
          remaining -= chunk
          progress = true
          break // one chunk per day per pass
        }
      }
      if (!progress) break
    }
    if (remaining > 0) wontFit.push({ itemId: item.id, shortMinutes: remaining })
  }

  return { add: add.sort((a, b) => a.start.localeCompare(b.start)), remove, wontFit }
}
