import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { StudySetTopic } from '../map/panelText'
import { notesForWeeks } from '../notes/notes'
import { buildTopicRequest, fetchTopic } from './client'
import type { ClassKind } from './classType'
import { again, answer, gotIt, startSession, topicFailed, topicReady, type SessionState } from './session'
import type { TopicError, TopicSet } from './shape'

export type StoredStudySet = {
  testId: string
  courseId: string
  className: string
  testTitle: string
  kind: ClassKind
  /** Mondays of the weeks the test covers; notes from these weeks go into the cards. */
  weeks: string[]
  createdAt: string
  topics: StudySetTopic[]
  session: SessionState
  generated: Record<string, TopicSet | { error: TopicError }>
}

export type SessionAction = 'gotIt' | 'again' | { correct: boolean }

export const isError = (g: StoredStudySet['generated'][string] | undefined): g is { error: TopicError } =>
  Boolean(g && 'error' in g)

async function load(testId: string): Promise<StoredStudySet | undefined> {
  return (await db.studySets.get(testId)) as StoredStudySet | undefined
}
async function save(set: StoredStudySet) {
  await db.studySets.put(set)
}

// One generation run per test at a time, even if the session screen is closed and reopened.
const running = new Set<string>()

/** Makes every topic that hasn't been made yet, first topic first, saving after each. */
async function generateMissing(testId: string, getToken: () => Promise<string | null>) {
  if (running.has(testId)) return
  running.add(testId)
  try {
    for (;;) {
      const set = await load(testId)
      const next = set?.topics.find((t) => !set.generated[t.id])
      if (!set || !next) return
      const result = await (async () => {
        try {
          const notes = await notesForWeeks(db, set.courseId, set.weeks)
          const req = await buildTopicRequest({ className: set.className, kind: set.kind, testTitle: set.testTitle, topic: next, notes })
          return await fetchTopic(req, await getToken())
        } catch {
          // Never leave a topic stuck on "Making cards": anything unexpected shows as a failure with Try again.
          return { error: 'failed' as const }
        }
      })()
      const latest = await load(testId)
      if (!latest) return
      if (latest.createdAt !== set.createdAt) continue // remade meanwhile: start over on the new set
      const failed = 'error' in result
      await save({
        ...latest,
        generated: { ...latest.generated, [next.id]: result },
        session: failed ? topicFailed(latest.session, next.id) : topicReady(latest.session, next.id, result.cards.length),
      })
      // Without sign-in, a key or quota, the other topics would fail the same way: stop here.
      if (failed && ['signed-out', 'not-configured', 'limit'].includes(result.error)) {
        const rest = Object.fromEntries(latest.topics.filter((t) => !latest.generated[t.id] && t.id !== next.id).map((t) => [t.id, result]))
        const stopped = await load(testId)
        if (stopped) {
          await save({
            ...stopped,
            generated: { ...stopped.generated, ...rest },
            session: Object.keys(rest).reduce((s, id) => topicFailed(s, id), stopped.session),
          })
        }
        return
      }
    }
  } finally {
    running.delete(testId)
  }
}

export type StartArgs = Omit<StoredStudySet, 'createdAt' | 'session' | 'generated'>

/** Saves a fresh set for a test (replacing any old one) and starts making its topics. */
export async function startStudySet(args: StartArgs, getToken: () => Promise<string | null>) {
  await save({ ...args, createdAt: new Date().toISOString(), session: startSession(args.topics.map((t) => t.id)), generated: {} })
  void generateMissing(args.testId, getToken)
}

export function useStudySet(testId: string | null, getToken: () => Promise<string | null>) {
  const set = useLiveQuery(async () => (testId ? ((await load(testId)) ?? null) : null), [testId])

  return {
    /** undefined while loading, null when there's no set for this test. */
    set,
    /** Switches between worked problems and idea cards; the set is made again. */
    async setKind(kind: ClassKind) {
      const s = testId ? await load(testId) : undefined
      if (s && s.kind !== kind) await startStudySet({ ...s, kind }, getToken)
    },
    /** Makes the set again from the same topics. */
    async remake() {
      const s = testId ? await load(testId) : undefined
      if (s) await startStudySet(s, getToken)
    },
    /** Picks up topics left unmade (the app was closed mid-way, or the student came back online). */
    resume() {
      if (testId) void generateMissing(testId, getToken)
    },
    async act(action: SessionAction) {
      const s = testId ? await load(testId) : undefined
      if (!s) return
      const current = s.topics[s.session.current]
      const made = current && s.generated[current.id]
      const questionCount = made && !isError(made) ? made.questions.length : 1
      const session =
        action === 'gotIt' ? gotIt(s.session) : action === 'again' ? again(s.session) : answer(s.session, action.correct, questionCount)
      await save({ ...s, session })
    },
    async retry(topicId: string) {
      const s = testId ? await load(testId) : undefined
      if (!s) return
      const generated = { ...s.generated }
      for (const t of s.topics) if (t.id === topicId || isError(generated[t.id])) delete generated[t.id]
      const session: SessionState = {
        ...s.session,
        topics: s.session.topics.map((t) => (generated[t.topicId] ? t : { ...t, phase: 'waiting' as const })),
        done: false,
      }
      await save({ ...s, generated, session })
      void generateMissing(s.testId, getToken)
    },
  }
}
