import { describe, expect, it } from 'vitest'
import { cleanWeekSet, validWeekRequest } from './shape'

describe('cleanWeekSet', () => {
  const sol = { steps: [{ label: 'Link', work: '$x^2 + y^2 = 100$' }], answer: '$\\frac{7}{8}$ ft/s' }
  const prob = (o: Record<string, unknown> = {}) => ({ prompt: 'p', choices: ['a', 'b', 'c', 'd'], correct: 2, whyWrong: ['w', 'w', '', 'w'], solution: sol, ...o })
  const lesson = { overview: 'Two rates tied by an equation.', example: { problem: 'Ladder', steps: [{ label: 'Link', work: 'x' }], answer: '3/2' } }
  const topic = (o: Record<string, unknown> = {}) => ({ title: 'Related rates', lesson, problems: [prob(), prob(), prob()], ...o })
  it('keeps a good week as is', () => {
    const good = { topics: [topic()] }
    expect(cleanWeekSet(good)).toEqual(good)
  })
  it('drops problems without a worked solution, and topics left too thin', () => {
    const set = cleanWeekSet({ topics: [topic({ problems: [prob(), prob(), prob(), prob({ solution: { steps: [], answer: '' } })] }), topic({ title: 'Thin', problems: [prob(), prob({ correct: 7 }), prob()] })] })!
    expect(set.topics.map((t) => t.title)).toEqual(['Related rates'])
    expect(set.topics[0].problems).toHaveLength(3)
  })
  it('drops topics without a lesson, and gives up when no topic is left', () => {
    expect(cleanWeekSet({ topics: [topic({ lesson: { overview: '', example: lesson.example } })] })).toBeNull()
    expect(cleanWeekSet({ topics: [] })).toBeNull()
    expect(cleanWeekSet(null)).toBeNull()
  })
})

describe('validWeekRequest', () => {
  const req = { className: 'MATH 120', kind: 'problems', testTitle: 'Test 3', week: { label: 'Week 10', items: [{ title: 'PS 8', hint: '2.5' }] }, notes: [] }
  it('needs a week with its items', () => {
    expect(validWeekRequest(req)).toBe(true)
    expect(validWeekRequest({ ...req, week: { label: 'Week 10' } })).toBe(false)
    expect(validWeekRequest({ ...req, week: { label: '', items: [] } })).toBe(false)
  })
})
