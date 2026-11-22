import { describe, expect, it } from 'vitest'
import { waitProgress } from './waiting'

describe('waitProgress', () => {
  it('moves through the steps on a schedule and never fills the bar', () => {
    expect(waitProgress(0)).toEqual({ step: 0, bar: 0, late: false })
    expect(waitProgress(12).step).toBe(1)
    expect(waitProgress(30).step).toBe(2)
    expect(waitProgress(60).step).toBe(3)
    expect(waitProgress(400)).toEqual({ step: 3, bar: 92, late: true })
    expect(waitProgress(119).late).toBe(false)
  })
})
