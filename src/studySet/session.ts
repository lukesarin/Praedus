/**
 * The rules of a study session, as pure functions over plain JSON (so it can be saved after
 * every answer). Each topic: flashcards until every card got "Got it", then a multiple-choice
 * check. 3 correct in a row learns it; 2 wrong sends you back to its cards; 8 questions without
 * the streak marks it for review, and review topics come back once at the end.
 */
export const STREAK_TO_LEARN = 3
export const WRONG_BEFORE_CARDS = 2
export const MAX_QUESTIONS = 8

export type TopicPhase = 'waiting' | 'cards' | 'check' | 'learned' | 'review' | 'error'
export type TopicState = {
  topicId: string
  phase: TopicPhase
  cardCount: number
  /** Card indexes still to get "Got it", front first. */
  cardQueue: number[]
  streak: number
  asked: number
  wrongInCheck: number
  questionIndex: number
  revisited: boolean
}
export type SessionState = { topics: TopicState[]; current: number; reviewPass: boolean; done: boolean }

const pending = (t: TopicState) => t.phase === 'cards' || t.phase === 'check'
const allCards = (n: number) => Array.from({ length: n }, (_, i) => i)

function withTopic(s: SessionState, i: number, change: Partial<TopicState>): SessionState {
  return { ...s, topics: s.topics.map((t, j) => (j === i ? { ...t, ...change } : t)) }
}

/** Chooses what to study next. Never leaves a topic that's in progress. */
function pick(s: SessionState): SessionState {
  if (pending(s.topics[s.current])) return { ...s, done: false }
  const next = s.topics.findIndex(pending)
  if (next >= 0) return { ...s, current: next, done: false }
  const waiting = s.topics.findIndex((t) => t.phase === 'waiting')
  if (waiting >= 0) return { ...s, current: waiting, done: false }
  const review = s.topics.findIndex((t) => t.phase === 'review' && !t.revisited)
  if (!s.reviewPass && review >= 0) {
    const topics = s.topics.map((t) =>
      t.phase === 'review'
        ? { ...t, phase: 'cards' as const, cardQueue: allCards(t.cardCount), streak: 0, asked: 0, wrongInCheck: 0, revisited: true }
        : t,
    )
    return { ...s, topics, current: review, reviewPass: true, done: false }
  }
  return { ...s, done: true }
}

export function startSession(topicIds: string[]): SessionState {
  const topics = topicIds.map((topicId) => ({
    topicId, phase: 'waiting' as const, cardCount: 0, cardQueue: [], streak: 0, asked: 0, wrongInCheck: 0, questionIndex: 0, revisited: false,
  }))
  return { topics, current: 0, reviewPass: false, done: topics.length === 0 }
}

/** A topic's cards and questions arrived (or arrived again after a retry). */
export function topicReady(s: SessionState, topicId: string, cardCount: number): SessionState {
  const i = s.topics.findIndex((t) => t.topicId === topicId)
  if (i < 0) return s
  return pick(withTopic(s, i, { phase: 'cards', cardCount, cardQueue: allCards(cardCount), streak: 0, asked: 0, wrongInCheck: 0 }))
}

export function topicFailed(s: SessionState, topicId: string): SessionState {
  const i = s.topics.findIndex((t) => t.topicId === topicId)
  return i < 0 ? s : pick(withTopic(s, i, { phase: 'error' }))
}

export function gotIt(s: SessionState): SessionState {
  const t = s.topics[s.current]
  if (t.phase !== 'cards') return s
  const cardQueue = t.cardQueue.slice(1)
  return withTopic(s, s.current, cardQueue.length ? { cardQueue } : { cardQueue, phase: 'check', streak: 0, wrongInCheck: 0 })
}

export function again(s: SessionState): SessionState {
  const t = s.topics[s.current]
  if (t.phase !== 'cards' || t.cardQueue.length === 0) return s
  return withTopic(s, s.current, { cardQueue: [...t.cardQueue.slice(1), t.cardQueue[0]] })
}

export function answer(s: SessionState, correct: boolean, questionCount: number): SessionState {
  const t = s.topics[s.current]
  if (t.phase !== 'check') return s
  const asked = t.asked + 1
  const questionIndex = (t.questionIndex + 1) % Math.max(1, questionCount)
  if (correct) {
    const streak = t.streak + 1
    if (streak >= STREAK_TO_LEARN) return pick(withTopic(s, s.current, { phase: 'learned', asked, questionIndex, streak }))
    if (asked >= MAX_QUESTIONS) return pick(withTopic(s, s.current, { phase: 'review', asked, questionIndex, streak }))
    return withTopic(s, s.current, { asked, questionIndex, streak })
  }
  if (asked >= MAX_QUESTIONS) return pick(withTopic(s, s.current, { phase: 'review', asked, questionIndex, streak: 0 }))
  const wrongInCheck = t.wrongInCheck + 1
  if (wrongInCheck >= WRONG_BEFORE_CARDS) {
    return withTopic(s, s.current, { phase: 'cards', cardQueue: allCards(t.cardCount), asked, questionIndex, streak: 0, wrongInCheck: 0 })
  }
  return withTopic(s, s.current, { asked, questionIndex, streak: 0, wrongInCheck })
}
