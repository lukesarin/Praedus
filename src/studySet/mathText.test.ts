import { describe, expect, it } from 'vitest'
import { mathParts, renderTex } from './mathText'

describe('mathParts', () => {
  it('splits text and $…$ math', () => {
    expect(mathParts('Find $x^2$ now')).toEqual([
      { math: false, text: 'Find ' },
      { math: true, tex: 'x^2' },
      { math: false, text: ' now' },
    ])
    expect(mathParts('$\\frac{1}{2}$')).toEqual([{ math: true, tex: '\\frac{1}{2}' }])
  })
  it('leaves dollar amounts and unmatched dollars as text', () => {
    expect(mathParts('It costs $5 and $10 to enter.')).toEqual([{ math: false, text: 'It costs $5 and $10 to enter.' }])
    expect(mathParts('only $x')).toEqual([{ math: false, text: 'only $x' }])
  })
  it('handles empty text', () => {
    expect(mathParts('')).toEqual([])
  })
})

describe('renderTex', () => {
  it('draws good LaTeX and gives up quietly on bad LaTeX', async () => {
    const katex = (await import('katex')).default
    const draw = (tex: string) => katex.renderToString(tex, { throwOnError: true, output: 'html' })
    expect(renderTex('x^2', draw)).toContain('katex')
    expect(renderTex('\\frac{1}{', draw)).toBeNull()
  })
})
