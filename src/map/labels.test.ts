import { describe, expect, it } from 'vitest'
import { labelBox, placeLabels, type Box } from './labels'

const dot = (id: string, x: number, y: number): Box & { id: string } => ({ id, x0: x - 5, x1: x + 5, y0: y - 5, y1: y + 5 })
const overlap = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1

describe('placeLabels', () => {
  it('puts a lone label on the side away from the class', () => {
    const left = { id: 'a', x: -100, y: 0, text: 'Problem Set 9' }
    const right = { id: 'b', x: 100, y: 40, text: 'Quiz 3' }
    const out = placeLabels([left, right], [dot('a', -100, 0), dot('b', 100, 40)])
    expect(out.get('a')).toEqual({ side: 'left', dy: 0 })
    expect(out.get('b')).toEqual({ side: 'right', dy: 0 })
  })

  it('flips a label that would cover a neighbor dot and its label', () => {
    // Problem Set 10's dot sits just left of Quiz 3's, at the same height.
    const labels = [
      { id: 'ps10', x: -180, y: 50, text: 'Problem Set 10' },
      { id: 'q3', x: -150, y: 50, text: 'Quiz 3' },
    ]
    const out = placeLabels(labels, [dot('ps10', -180, 50), dot('q3', -150, 50)])
    expect(out.get('ps10')).toEqual({ side: 'left', dy: 0 })
    expect(out.get('q3')?.side).toBe('right')
    const a = labelBox(labels[0], out.get('ps10')!)
    const b = labelBox(labels[1], out.get('q3')!)
    expect(overlap(a, b)).toBe(false)
  })

  it('nudges up or down when both sides are taken at the same height', () => {
    const labels = [
      { id: 'a', x: -100, y: 0, text: 'Problem Set 8' },
      { id: 'b', x: -100, y: 6, text: 'Quiz 3' },
    ]
    const out = placeLabels(labels, [dot('a', -100, 0), dot('b', -100, 6)])
    const a = labelBox(labels[0], out.get('a')!)
    const b = labelBox(labels[1], out.get('b')!)
    expect(overlap(a, b)).toBe(false)
  })

  it('falls back to the fewest collisions when nothing is clear', () => {
    const l = { id: 'a', x: 0, y: 0, text: 'Problem Set 1' }
    // Walls on both sides, at every nudge.
    const walls: Box[] = [
      { x0: -200, x1: -10, y0: -30, y1: 30 },
      { x0: 10, x1: 200, y0: -30, y1: 30 },
    ]
    const out = placeLabels([l], walls)
    expect(out.get('a')).toEqual({ side: 'right', dy: 0 })
  })
})
