import { describe, expect, it } from 'vitest'
import { again, answer, gotIt, startSession, topicFailed, topicReady, type SessionState } from './session'

const Q = 6
const ready = (ids: string[], cards = 3) => ids.reduce((s, id) => topicReady(s, id, cards), startSession(ids))
const cur = (s: SessionState) => s.topics[s.current]
/** Says "Got it" until the current topic reaches its check. */
const throughCards = (s: SessionState) => {
  while (cur(s).phase === 'cards') s = gotIt(s)
  return s
}
const answers = (s: SessionState, list: boolean[]) => list.reduce((x, ok) => answer(x, ok, Q), s)

describe('cards', () => {
  it('sends "Again" cards to the back and checks only once every card got "Got it"', () => {
    let s = ready(['a'])
    expect(cur(s)).toMatchObject({ phase: 'cards', cardQueue: [0, 1, 2] })
    s = again(s)
    expect(cur(s).cardQueue).toEqual([1, 2, 0])
    s = gotIt(gotIt(s))
    expect(cur(s)).toMatchObject({ phase: 'cards', cardQueue: [0] })
    s = gotIt(s)
    expect(cur(s)).toMatchObject({ phase: 'check', streak: 0 })
  })
})

describe('the check', () => {
  it('learns a topic after 3 correct in a row and moves on', () => {
    let s = throughCards(ready(['a', 'b']))
    s = answers(s, [true, true, true])
    expect(s.topics[0].phase).toBe('learned')
    expect(s.current).toBe(1)
  })
  it('a wrong answer resets the streak; a second sends you back to the cards', () => {
    let s = throughCards(ready(['a']))
    s = answers(s, [true, false])
    expect(cur(s)).toMatchObject({ phase: 'check', streak: 0, wrongInCheck: 1 })
    s = answer(s, false, Q)
    expect(cur(s)).toMatchObject({ phase: 'cards', cardQueue: [0, 1, 2], wrongInCheck: 0, streak: 0 })
  })
  it('asks the next question each time, wrapping around', () => {
    let s = throughCards(ready(['a']))
    s = answers(s, [true, true])
    expect(cur(s).questionIndex).toBe(2)
    s = [true, false, true].reduce((x, ok) => answer(x, ok, 2), throughCards(ready(['a'])))
    expect(cur(s)).toMatchObject({ questionIndex: 1, streak: 1 })
  })
  it('marks a topic for review after 8 questions without 3 in a row', () => {
    let s = throughCards(ready(['a', 'b']))
    s = answers(s, [true, true, false]) // 3 asked
    s = answers(s, [true, false]) // 5 asked, second wrong: back to the cards
    s = throughCards(s)
    s = answers(s, [true, true, false]) // 8 asked
    expect(s.topics[0].phase).toBe('review')
    expect(s.current).toBe(1)
  })
})

describe('the review pass', () => {
  const failTopic = (s: SessionState) => {
    s = throughCards(s)
    s = answers(s, [true, true, false, true, false])
    s = throughCards(s)
    return answers(s, [true, true, false])
  }
  it('brings review topics back once at the end, then finishes', () => {
    let s = failTopic(ready(['a', 'b']))
    s = answers(throughCards(s), [true, true, true]) // b learned
    expect(s.reviewPass).toBe(true)
    expect(s.current).toBe(0)
    expect(cur(s)).toMatchObject({ phase: 'cards', revisited: true, asked: 0 })
    s = failTopic(s)
    expect(s.topics[0].phase).toBe('review')
    expect(s.done).toBe(true)
  })
  it('finishes straight away when every topic was learned', () => {
    let s = answers(throughCards(ready(['a'])), [true, true, true])
    expect(s.done).toBe(true)
    expect(s.reviewPass).toBe(false)
  })
})

describe('generation order', () => {
  it('studies a later ready topic while an earlier one is still being made, without jumping back mid-topic', () => {
    let s = topicReady(startSession(['a', 'b', 'c']), 'b', 2)
    expect(s.current).toBe(1)
    s = gotIt(s)
    s = topicReady(s, 'a', 2)
    expect(s.current).toBe(1)
    s = answers(throughCards(s), [true, true, true])
    expect(s.current).toBe(0)
  })
  it('waits on a topic still being made, and treats a failed one as done until retried', () => {
    let s = startSession(['a', 'b'])
    expect(cur(s).phase).toBe('waiting')
    s = topicFailed(s, 'a')
    expect(s.current).toBe(1)
    expect(s.done).toBe(false)
    s = topicReady(s, 'b', 1)
    s = answers(throughCards(s), [true, true, true])
    expect(s.done).toBe(true)
    s = topicReady(s, 'a', 1)
    expect(s.done).toBe(false)
    expect(s.current).toBe(0)
  })
})

it('is plain JSON', () => {
  let s = topicReady(startSession(['a', 'b']), 'a', 3)
  s = answers(throughCards(again(s)), [true, false])
  expect(JSON.parse(JSON.stringify(s))).toEqual(s)
})
