import { describe, expect, it } from 'vitest'
import type { CalendarItem } from '../db/db'
import { groupAssignments } from './group'

const today = new Date(2026, 10, 20, 15, 0) // Nov 20, 3 PM local

function a(id: string, start: string, extra: Partial<CalendarItem> = {}): CalendarItem {
  return {
    id, uid: id, feedId: 'f', kind: 'assignment', title: id, start, allDay: true,
    done: false, userEdited: false, removedFromSource: false, ...extra,
  }
}

describe('groupAssignments', () => {
  it('buckets by local due date and keeps done items apart', () => {
    const groups = groupAssignments(
      [
        a('later', '2026-11-28'),
        a('overdue', '2026-11-19'),
        a('today', '2026-11-20'),
        a('week-edge', '2026-11-27'),
        a('tomorrow', '2026-11-21'),
        a('done-overdue', '2026-11-01', { done: true }),
        a('event', '2026-11-20', { kind: 'event' }),
      ],
      today,
    )
    expect(groups.map((g) => [g.label, g.items.map((i) => i.id)])).toEqual([
      ['Overdue', ['overdue']],
      ['Today', ['today']],
      ['This week', ['tomorrow', 'week-edge']],
      ['Later', ['later']],
      ['Done', ['done-overdue']],
    ])
  })

  it('uses the local day for timed deadlines', () => {
    const lateTonight = new Date(2026, 10, 20, 23, 59).toISOString()
    const [g] = groupAssignments([a('tonight', lateTonight, { allDay: false })], today)
    expect(g.label).toBe('Today')
  })

  it('returns no groups for no assignments', () => {
    expect(groupAssignments([], today)).toEqual([])
  })

  it('leaves out assignments kept as history', () => {
    const groups = groupAssignments([a('old', '2026-09-01', { keptAsHistory: true })], today)
    expect(groups).toEqual([])
  })
})
