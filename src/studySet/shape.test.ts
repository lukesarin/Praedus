import { describe, expect, it } from 'vitest'
import { cleanTopicSet, cleanWeekSet, validTopicRequest, validWeekRequest } from './shape'

const q = (o: Record<string, unknown> = {}) => ({ prompt: 'p', choices: ['a', 'b', 'c', 'd'], correct: 1, whyWrong: ['w', '', 'w', 'w'], ...o })
const card = { front: 'f', back: 'b' }

describe('cleanTopicSet', () => {
  it('keeps a good set as is', () => {
    const good = { cards: [card], questions: [q(), q(), q()] }
    expect(cleanTopicSet(good)).toEqual(good)
  })
  it('drops malformed questions and cards', () => {
    const raw = {
      cards: [card, { front: '', back: 'x' }],
      questions: [q(), q({ choices: ['a', 'b', 'c'] }), q({ correct: 4 }), q({ whyWrong: ['w'] }), q(), q({ correct: 0 })],
    }
    const set = cleanTopicSet(raw)!
    expect(set.cards).toEqual([card])
    expect(set.questions).toHaveLength(3)
  })
  it('gives up when too little is left', () => {
    expect(cleanTopicSet({ cards: [card], questions: [q(), q()] })).toBeNull()
    expect(cleanTopicSet({ cards: [], questions: [q(), q(), q()] })).toBeNull()
    expect(cleanTopicSet('nonsense')).toBeNull()
  })
})

describe('validTopicRequest', () => {
  const req = { className: 'MATH 120', kind: 'problems', testTitle: 'Test 3', topic: { title: 'PS 8', hint: '' }, notes: [] }
  it('accepts a complete request and rejects broken ones', () => {
    expect(validTopicRequest(req)).toBe(true)
    expect(validTopicRequest({ ...req, kind: 'maths' })).toBe(false)
    expect(validTopicRequest({ ...req, topic: { title: '' } })).toBe(false)
    expect(validTopicRequest({ ...req, notes: [{ name: 'a', kind: 'pdf', mime: 'application/pdf' }] })).toBe(false)
    expect(validTopicRequest(null)).toBe(false)
  })
})

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
