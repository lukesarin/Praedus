import { describe, expect, it } from 'vitest'
import type { CalendarItem } from '../db/db'
import { coverLine, countdown, plainDescription, weekHeading } from './panelText'
import type { Unit } from './units'

const item = (title: string) => ({ title }) as CalendarItem
const unit = (o: Partial<Unit>): Unit => ({
  test: item('Test 3'),
  weeks: [],
  items: [],
  cumulative: false,
  ...o,
})

describe('countdown', () => {
  const now = new Date(2026, 10, 21, 12, 0)
  it('counts calendar days', () => {
    expect(countdown(new Date(2026, 10, 24, 10, 0).getTime(), now)).toBe('in 3 days')
    expect(countdown(new Date(2026, 10, 21, 23, 0).getTime(), now)).toBe('today')
    expect(countdown(new Date(2026, 10, 22, 8, 0).getTime(), now)).toBe('tomorrow')
    expect(countdown(new Date(2026, 10, 20, 8, 0).getTime(), now)).toBe('yesterday')
    expect(countdown(new Date(2026, 8, 15, 8, 0).getTime(), now)).toBe('67 days ago')
  })
})

describe('coverLine', () => {
  const prev = item('Test 2')
  it('numbered weeks', () => {
    const weeks = [9, 10, 11, 12, 13].map((n) => ({ start: `2026-10-${12 + n}`, number: n }))
    expect(coverLine(unit({ previous: prev, weeks }))).toBe('Covers weeks 9 to 13, since Test 2')
  })
  it('unnumbered weeks', () => {
    const weeks = [{ start: '2026-10-19' }, { start: '2026-11-16' }]
    expect(coverLine(unit({ previous: prev, weeks }))).toBe('Covers Oct 19 to Nov 22, since Test 2')
  })
  it('cumulative wins', () => {
    expect(coverLine(unit({ cumulative: true, earliestKnown: '2026-10-26', weeks: [{ start: '2026-10-26' }] }))).toBe(
      'Covers the whole semester',
    )
  })
  it('earliest known', () => {
    expect(coverLine(unit({ earliestKnown: '2026-10-26', weeks: [{ start: '2026-10-26' }] }))).toBe(
      'Covers everything since Oct 26, the earliest work Praedus has for this class',
    )
  })
  it('start of term', () => {
    const weeks = [1, 2, 3].map((n) => ({ start: `2026-09-0${n}`, number: n }))
    expect(coverLine(unit({ weeks }))).toBe('Covers weeks 1 to 3, since the start of term')
  })
  it('empty weeks', () => {
    expect(coverLine(unit({ previous: item('Midterm exam') }))).toBe('Nothing due between Midterm exam and this test')
    expect(coverLine(unit({}))).toBe('Nothing due before this test')
  })
})

describe('weekHeading', () => {
  it('numbered or dated', () => {
    expect(weekHeading({ start: '2026-10-19', number: 9 })).toBe('Week 9')
    expect(weekHeading({ start: '2026-10-19' })).toBe('Week of Oct 19')
  })
})

describe('plainDescription', () => {
  it('cleans html', () => {
    expect(plainDescription('<p>Read <b>ch. 4</b> &amp; answer&nbsp;Q1–3</p>')).toBe('Read ch. 4 & answer Q1–3')
  })
  it('cuts long text at a word', () => {
    const out = plainDescription('word '.repeat(100))
    expect(out.length).toBeLessThanOrEqual(141)
    expect(out.endsWith('…')).toBe(true)
  })
  it('handles undefined', () => {
    expect(plainDescription(undefined)).toBe('')
  })
})
