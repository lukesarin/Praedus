import { describe, expect, it } from 'vitest'
import { COURSE_COLORS, nextCourseColor } from './colors'

describe('default course colors', () => {
  it('keeps eight colors', () => {
    expect(COURSE_COLORS).toHaveLength(8)
  })

  it('avoids greens and teals that could be mistaken for the mint study blocks', () => {
    expect(COURSE_COLORS).not.toContain('#5fb88a')
    expect(COURSE_COLORS).not.toContain('#56b6c2')
    expect(COURSE_COLORS).toContain('#f08bb4')
    expect(COURSE_COLORS).toContain('#e8c35a')
  })

  it('still hands out colors in order, wrapping around', () => {
    expect(nextCourseColor(0)).toBe(COURSE_COLORS[0])
    expect(nextCourseColor(8)).toBe(COURSE_COLORS[0])
  })
})
