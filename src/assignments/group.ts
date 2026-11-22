import type { CalendarItem } from '../db/db'
import { addDays, itemDateKey, localDateKey } from '../calendar/dates'

export type GroupLabel = 'Overdue' | 'Today' | 'This week' | 'Later' | 'Done'
export type AssignmentGroup = { label: GroupLabel; items: CalendarItem[] }

const ORDER: GroupLabel[] = ['Overdue', 'Today', 'This week', 'Later', 'Done']

/** Buckets assignments by due date in the viewer's time zone. "This week" means the next 7 days. */
export function groupAssignments(items: CalendarItem[], today: Date): AssignmentGroup[] {
  const todayKey = localDateKey(today)
  const weekEnd = addDays(todayKey, 7)
  const buckets = new Map<GroupLabel, CalendarItem[]>(ORDER.map((l) => [l, []]))

  const sorted = items
    .filter((i) => i.kind === 'assignment' && !i.keptAsHistory)
    .sort((a, b) => itemDateKey(a).localeCompare(itemDateKey(b)) || a.start.localeCompare(b.start))

  for (const item of sorted) {
    const key = itemDateKey(item)
    const label: GroupLabel = item.done
      ? 'Done'
      : key < todayKey
        ? 'Overdue'
        : key === todayKey
          ? 'Today'
          : key <= weekEnd
            ? 'This week'
            : 'Later'
    buckets.get(label)!.push(item)
  }
  return ORDER.map((label) => ({ label, items: buckets.get(label)! })).filter((g) => g.items.length)
}
