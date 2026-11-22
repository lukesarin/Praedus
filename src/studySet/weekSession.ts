/**
 * The rules of a study session, week by week, as pure functions over plain JSON (saved after every
 * answer). Each topic: a lesson, then problems. 3 right in a row learns it; 2 misses (wrong or
 * skipped) bring the lesson back; 8 problems without the streak mark it for review, and review
 * topics come back once at the end.
 */
export const STREAK_TO_LEARN = 3
export const MISSES_BEFORE_LESSON = 2
export const MAX_PROBLEMS = 8

export type TopicPhase = 'lesson' | 'problems' | 'learned' | 'review'
export type TopicState = {
  phase: TopicPhase
  problemCount: number
  streak: number
  misses: number
  asked: number
  problemIndex: number
  revisited: boolean
  /** The lesson is showing again after two misses. */
  again: boolean
}
export type WeekState = { weekId: string; status: 'waiting' | 'ready' | 'error'; topics: TopicState[] }
/** `topic: -1` means the session is waiting for that week's cards. */
export type SessionState = { weeks: WeekState[]; current: { week: number; topic: number } | null; reviewPass: boolean; done: boolean }

const active = (t: TopicState) => t.phase === 'lesson' || t.phase === 'problems'
const freshTopic = (problemCount: number): TopicState => ({
  phase: 'lesson', problemCount, streak: 0, misses: 0, asked: 0, problemIndex: 0, revisited: false, again: false,
})

function currentTopic(s: SessionState): TopicState | null {
  if (!s.current || s.current.topic < 0) return null
  return s.weeks[s.current.week]?.topics[s.current.topic] ?? null
}

function withCurrent(s: SessionState, change: Partial<TopicState>): SessionState {
  const c = s.current!
  return {
    ...s,
    weeks: s.weeks.map((w, i) => (i !== c.week ? w : { ...w, topics: w.topics.map((t, j) => (j === c.topic ? { ...t, ...change } : t)) })),
  }
}

/** Chooses what to study next: the topic in progress, else the earliest unfinished one, else wait, review or finish. */
function pick(s: SessionState): SessionState {
  const cur = currentTopic(s)
  if (cur && active(cur)) return { ...s, done: false }
  for (let w = 0; w < s.weeks.length; w++) {
    const week = s.weeks[w]
    if (week.status === 'waiting') return { ...s, current: { week: w, topic: -1 }, done: false }
    if (week.status !== 'ready') continue
    const t = week.topics.findIndex(active)
    if (t >= 0) return { ...s, current: { week: w, topic: t }, done: false }
  }
  if (!s.reviewPass && s.weeks.some((w) => w.topics.some((t) => t.phase === 'review'))) {
    const weeks = s.weeks.map((w) => ({
      ...w,
      topics: w.topics.map((t) => (t.phase === 'review' ? { ...freshTopic(t.problemCount), revisited: true, problemIndex: t.problemIndex } : t)),
    }))
    return pick({ ...s, weeks, current: null, reviewPass: true })
  }
  return { ...s, current: null, done: true }
}

export function startSession(weekIds: string[]): SessionState {
  return pick({ weeks: weekIds.map((weekId) => ({ weekId, status: 'waiting', topics: [] })), current: null, reviewPass: false, done: false })
}

/** A week's topics arrived; `problemCounts` has one entry per topic. */
export function weekReady(s: SessionState, weekId: string, problemCounts: number[]): SessionState {
  const weeks = s.weeks.map((w) => (w.weekId === weekId ? { ...w, status: 'ready' as const, topics: problemCounts.map(freshTopic) } : w))
  // A waiting position isn't "in progress": let pick land on the new topics.
  const waiting = s.current?.topic === -1
  return pick({ ...s, weeks, current: waiting ? null : s.current })
}

export function weekFailed(s: SessionState, weekId: string): SessionState {
  const weeks = s.weeks.map((w) => (w.weekId === weekId ? { ...w, status: 'error' as const, topics: [] } : w))
  return pick({ ...s, weeks, current: s.current?.topic === -1 ? null : s.current })
}

/** "Try problems" on a lesson. */
export function startProblems(s: SessionState): SessionState {
  const t = currentTopic(s)
  return t?.phase === 'lesson' ? withCurrent(s, { phase: 'problems', again: false }) : s
}

function miss(s: SessionState, t: TopicState, asked: number, problemIndex: number): SessionState {
  if (asked >= MAX_PROBLEMS) return pick(withCurrent(s, { phase: 'review', asked, problemIndex, streak: 0 }))
  const misses = t.misses + 1
  if (misses >= MISSES_BEFORE_LESSON) return withCurrent(s, { phase: 'lesson', again: true, misses: 0, streak: 0, asked, problemIndex })
  return withCurrent(s, { misses, streak: 0, asked, problemIndex })
}

export function answer(s: SessionState, correct: boolean): SessionState {
  const t = currentTopic(s)
  if (!t || t.phase !== 'problems') return s
  const asked = t.asked + 1
  const problemIndex = (t.problemIndex + 1) % Math.max(1, t.problemCount)
  if (!correct) return miss(s, t, asked, problemIndex)
  const streak = t.streak + 1
  if (streak >= STREAK_TO_LEARN) return pick(withCurrent(s, { phase: 'learned', streak, asked, problemIndex }))
  if (asked >= MAX_PROBLEMS) return pick(withCurrent(s, { phase: 'review', streak, asked, problemIndex }))
  return withCurrent(s, { streak, asked, problemIndex })
}

/** "Got it" after "I'm stuck": a miss, but not a wrong answer. */
export function skip(s: SessionState): SessionState {
  const t = currentTopic(s)
  if (!t || t.phase !== 'problems') return s
  return miss(s, t, t.asked + 1, (t.problemIndex + 1) % Math.max(1, t.problemCount))
}

/** Studies another topic now. Only topics still to learn, in weeks that are ready. */
export function jump(s: SessionState, week: number, topic: number): SessionState {
  const w = s.weeks[week]
  const t = w?.status === 'ready' ? w.topics[topic] : undefined
  if (!t || !active(t)) return s
  return { ...s, current: { week, topic }, done: false }
}

/** Try again: these failed weeks wait for their cards once more. */
export function retryWeeks(s: SessionState, weekIds: string[]): SessionState {
  const ids = new Set(weekIds)
  const weeks = s.weeks.map((w) => (ids.has(w.weekId) && w.status === 'error' ? { ...w, status: 'waiting' as const } : w))
  return pick({ ...s, weeks, current: currentTopic(s) ? s.current : null })
}
