import { describe, expect, it } from 'vitest'
import { localInstant } from '../commitments/expand'
import type { CalendarItem } from '../db/db'
import { coverage } from './coverage'

const now = localInstant('2026-11-20', '12:00')
const iso = (d: string, t: string) => localInstant(d, t).toISOString()
const item = (id: string, extra: Partial<CalendarItem> = {}): CalendarItem => ({
  id, uid: id, feedId: 'f', kind: 'assignment', title: id, start: iso('2026-11-25', '23:59'), allDay: false,
  done: false, userEdited: false, removedFromSource: false, estimateMinutes: 180, ...extra,
})

describe('coverage', () => {
  it('splits time into studied (past) and planned (future), and what is still short', () => {
    const blocks = [
      { id: '1', itemId: 'a', start: iso('2026-11-19', '10:00'), end: iso('2026-11-19', '11:00'), pinned: false },
      { id: '2', itemId: 'a', start: iso('2026-11-21', '10:00'), end: iso('2026-11-21', '10:30'), pinned: false },
    ]
    const [a] = coverage([item('a')], blocks, now)
    expect(a).toMatchObject({ estimate: 180, studied: 60, planned: 30, short: 90 })
  })

  it('lists only upcoming, unfinished assignments that are short, soonest first', () => {
    const list = coverage(
      [
        item('later', { start: iso('2026-12-01', '23:59') }),
        item('soon'),
        item('done', { done: true }),
        item('past', { start: iso('2026-11-19', '23:59') }),
        item('event', { kind: 'event' }),
      ],
      [],
      now,
    ).filter((c) => c.short > 0)
    expect(list.map((c) => c.item.id)).toEqual(['soon', 'later'])
  })

  it('coverage includes upcoming test events', () => {
    const ev = item('mid', { kind: 'event', title: 'Midterm Exam', estimateMinutes: undefined })
    const list = coverage([ev], [], now)
    expect(list).toHaveLength(1)
    expect(list[0].estimate).toBe(240)
  })

  it('reports a test posted twice once, as the event', () => {
    const due = '2026-11-25'
    const list = coverage(
      [
        item('a', { title: 'Midterm Exam', allDay: true, start: due, courseId: 'c', estimateMinutes: undefined }),
        item('e', { title: 'Midterm Exam', kind: 'event', allDay: true, start: due, courseId: 'c', estimateMinutes: undefined }),
      ],
      [],
      now,
    )
    expect(list.map((c) => c.item.id)).toEqual(['e'])
    expect(list[0].estimate).toBe(240)
  })
})
