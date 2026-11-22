import { describe, expect, it } from 'vitest'
import type { CalendarItem } from '../db/db'
import { duplicateTestIds, isFinal, isPlannable, isTest, plannableItems } from './testItems'

const a = (title: string) => ({ kind: 'assignment' as const, title })
const e = (title: string) => ({ kind: 'event' as const, title })

describe('isTest', () => {
  it('recognises tests, exams and midterms', () => {
    for (const i of [a('Test 3'), a('Midterm exam'), a('Final exam'), e('Midterm Exam')]) expect(isTest(i)).toBe(true)
  })
  it('rejects other work and non-test events', () => {
    for (const i of [a('Essay 1 final'), a('Quiz 4'), a('Testing lab'), e('Exam review session'), e('Midterm office hours'), e('Test help')])
      expect(isTest(i)).toBe(false)
  })
})

describe('isFinal', () => {
  it('is a test with "final" in the title', () => {
    expect(isFinal(a('Final exam'))).toBe(true)
    expect(isFinal(e('FINAL EXAM'))).toBe(true)
    expect(isFinal(a('Test 3'))).toBe(false)
    expect(isFinal(a('Final project'))).toBe(false)
  })
})

describe('isPlannable', () => {
  it('is any assignment, or a test event', () => {
    expect(isPlannable(a('Lab 9'))).toBe(true)
    expect(isPlannable(e('Midterm Exam'))).toBe(true)
    expect(isPlannable(e('Office hours'))).toBe(false)
  })
})

describe('duplicate tests', () => {
  const mk = (id: string, kind: 'assignment' | 'event', title: string, start: string, courseId = 'c'): CalendarItem => ({
    id, uid: id, feedId: 'f', kind, title, start, allDay: true, courseId, done: false, userEdited: false, removedFromSource: false,
  })
  it('flags the assignment, not the event, for the same course, title and day', () => {
    const items = [mk('a', 'assignment', 'Midterm Exam', '2026-11-25'), mk('e', 'event', 'midterm exam ', '2026-11-25')]
    expect([...duplicateTestIds(items)]).toEqual(['a'])
    expect(plannableItems(items).map((i) => i.id)).toEqual(['e'])
  })
  it('keeps both when the course or day differs', () => {
    const items = [mk('a', 'assignment', 'Midterm Exam', '2026-11-25'), mk('e', 'event', 'Midterm Exam', '2026-11-26'), mk('o', 'event', 'Midterm Exam', '2026-11-25', 'other')]
    expect(duplicateTestIds(items).size).toBe(0)
  })
})
