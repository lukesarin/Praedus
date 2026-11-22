import { describe, expect, it } from 'vitest'
import { dayHeaderParts } from './dayHeader'

describe('dayHeaderParts', () => {
  it('splits a date into a short weekday and the day of the month', () => {
    expect(dayHeaderParts(new Date(2026, 10, 24))).toEqual({ weekday: 'Tue', day: 24 })
  })

  it('uses the local calendar day, not UTC, late in the evening', () => {
    expect(dayHeaderParts(new Date(2026, 10, 29, 23, 30))).toEqual({ weekday: 'Sun', day: 29 })
  })
})
