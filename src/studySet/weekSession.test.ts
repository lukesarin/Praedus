import { describe, expect, it } from 'vitest'
import { answer, jump, retryWeeks, skip, startProblems, startSession, weekFailed, weekReady, type SessionState } from './weekSession'

const topic = (s: SessionState) => (s.current && s.current.topic >= 0 ? s.weeks[s.current.week].topics[s.current.topic] : null)
const learn = (s: SessionState) => [true, true, true].reduce((x, ok) => answer(x, ok), startProblems(s))
const ready = (ids: string[], counts: number[][]) => ids.reduce((s, id, i) => weekReady(s, id, counts[i]), startSession(ids))

describe('one topic', () => {
  it('starts with the lesson, then problems', () => {
    let s = ready(['w9'], [[6]])
    expect(topic(s)).toMatchObject({ phase: 'lesson', again: false })
    s = startProblems(s)
    expect(topic(s)).toMatchObject({ phase: 'problems', streak: 0 })
  })
  it('learns after 3 right in a row and moves to the next topic, then the next week', () => {
    let s = ready(['w9', 'w10'], [[6, 6], [6]])
    s = learn(s)
    expect(s.weeks[0].topics[0].phase).toBe('learned')
    expect(s.current).toEqual({ week: 0, topic: 1 })
    s = learn(s)
    expect(s.current).toEqual({ week: 1, topic: 0 })
  })
  it('a wrong answer and a skip bring the lesson back', () => {
    let s = startProblems(ready(['w9'], [[6]]))
    s = answer(s, true)
    s = answer(s, false)
    expect(topic(s)).toMatchObject({ phase: 'problems', streak: 0, misses: 1 })
    s = skip(s)
    expect(topic(s)).toMatchObject({ phase: 'lesson', again: true, misses: 0, streak: 0 })
    s = startProblems(s)
    expect(topic(s)).toMatchObject({ phase: 'problems', again: false })
  })
  it('asks each problem in turn, wrapping', () => {
    let s = startProblems(ready(['w9'], [[2]]))
    s = answer(answer(answer(s, true), false), true)
    expect(topic(s)).toMatchObject({ problemIndex: 1, streak: 1 })
  })
  it('marks review after 8 problems without 3 in a row, then revisits once at the end', () => {
    const miss8 = (x: SessionState) => {
      x = startProblems(x)
      x = [true, true, false, true].reduce((y, ok) => answer(y, ok), x) // 4 asked, 1 miss
      x = skip(x) // 5 asked, 2 misses: lesson again
      x = startProblems(x)
      return [true, true, false].reduce((y, ok) => answer(y, ok), x) // 8 asked
    }
    let s = ready(['w9'], [[6, 6]])
    s = miss8(s)
    expect(s.weeks[0].topics[0].phase).toBe('review')
    s = learn(s)
    expect(s.reviewPass).toBe(true)
    expect(s.current).toEqual({ week: 0, topic: 0 })
    expect(topic(s)).toMatchObject({ phase: 'lesson', revisited: true, asked: 0 })
    s = miss8(s)
    expect(s.done).toBe(true)
  })
})

describe('weeks still being made', () => {
  it('waits on the next week, and skips a week that failed', () => {
    let s = weekReady(startSession(['w9', 'w10', 'w11']), 'w9', [6])
    s = learn(s)
    expect(s.current).toEqual({ week: 1, topic: -1 })
    s = weekFailed(s, 'w10')
    expect(s.current).toEqual({ week: 2, topic: -1 })
    s = weekReady(s, 'w11', [6])
    expect(s.current).toEqual({ week: 2, topic: 0 })
    s = learn(s)
    expect(s.done).toBe(true)
  })
})

describe('jumping', () => {
  it('goes to a later topic and comes back to the earliest unfinished one after', () => {
    let s = ready(['w9', 'w10'], [[6], [6]])
    s = jump(s, 1, 0)
    expect(s.current).toEqual({ week: 1, topic: 0 })
    s = learn(s)
    expect(s.current).toEqual({ week: 0, topic: 0 })
  })
  it('ignores jumps to learned topics or weeks not ready', () => {
    let s = learn(ready(['w9', 'w10'], [[6], [6]]))
    expect(jump(s, 0, 0)).toBe(s)
    s = startSession(['a', 'b'])
    expect(jump(s, 1, 0)).toBe(s)
  })
})

it('is plain JSON', () => {
  const s = skip(answer(startProblems(ready(['w9'], [[6]])), true))
  expect(JSON.parse(JSON.stringify(s))).toEqual(s)
})

describe('retryWeeks', () => {
  it('puts failed weeks back to waiting and waits on the first one', () => {
    let s = weekFailed(weekFailed(startSession(['w9', 'w10']), 'w9'), 'w10')
    expect(s.done).toBe(true)
    s = retryWeeks(s, ['w9', 'w10'])
    expect(s).toMatchObject({ done: false, current: { week: 0, topic: -1 } })
    expect(s.weeks.map((w) => w.status)).toEqual(['waiting', 'waiting'])
  })
})
