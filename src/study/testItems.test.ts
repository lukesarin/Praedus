import { describe, expect, it } from 'vitest'
import { isFinal, isPlannable, isTest } from './testItems'

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
