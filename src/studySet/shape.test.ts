import { describe, expect, it } from 'vitest'
import { cleanTopicSet, validTopicRequest } from './shape'

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
