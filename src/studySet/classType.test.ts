import { describe, expect, it } from 'vitest'
import { classType } from './classType'

describe('classType', () => {
  it('gives problem classes worked problems and the rest idea cards', () => {
    expect(classType('MATH 120 Calculus I')).toBe('problems')
    expect(classType('CS 210 Intro to Programming')).toBe('problems')
    expect(classType('PHYS-101 Mechanics')).toBe('problems')
    expect(classType('ENGL 101 Composition')).toBe('ideas')
    expect(classType('HIST 200 Modern Europe')).toBe('ideas')
    expect(classType('Intro to Film')).toBe('ideas')
  })
})
