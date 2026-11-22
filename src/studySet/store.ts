import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { notesForWeeks } from '../notes/notes'
import { buildWeekRequest, fetchWeek } from './client'
import type { ClassKind } from './classType'
import type { TopicError, WeekSet } from './shape'
import { answer, jump, retryWeeks, skip, startProblems, startSession, weekFailed, weekReady, type SessionState } from './weekSession'

/** One week of the test as planned on the confirm step. `start` is its Monday; the student's own topics have none. */
export type PlanWeek = { weekId: string; label: string; start?: string; items: { title: string; hint: string }[] }

export type StoredStudySet = {
  version: 2
  testId: string
  courseId: string
  className: string
  testTitle: string
  kind: ClassKind
  createdAt: string
  weeks: PlanWeek[]
  session: SessionState
  generated: Record<string, WeekSet | { error: TopicError }>
}

export type SessionAction = 'startProblems' | 'skip' | { correct: boolean } | { jump: [number, number] }

export const isError = (g: StoredStudySet['generated'][string] | undefined): g is { error: TopicError } =>
  Boolean(g && 'error' in g)

/** The saved set; 'old' when it was made before study sets went week by week. */
async function load(testId: string): Promise<StoredStudySet | 'old' | undefined> {
  const row = (await db.studySets.get(testId)) as { version?: number } | undefined
  if (!row) return undefined
  return row.version === 2 ? (row as StoredStudySet) : 'old'
}
async function loadV2(testId: string): Promise<StoredStudySet | undefined> {
  const s = await load(testId)
  return s === 'old' ? undefined : s
}
async function save(set: StoredStudySet) {
  await db.studySets.put(set)
}

// One generation run per test at a time, even if the session screen is closed and reopened.
const running = new Set<string>()
// When each week's cards started being made, for the waiting screen's timer (survives leaving the screen).
const startedAt = new Map<string, number>()
export const generatingSince = (testId: string, weekId: string) => startedAt.get(`${testId}|${weekId}`)
const STOPPING: TopicError[] = ['signed-out', 'not-configured', 'limit']

/** Makes every week that hasn't been made yet, first week first, saving after each. */
async function generateMissing(testId: string, getToken: () => Promise<string | null>) {
  if (running.has(testId)) return
  running.add(testId)
  try {
    for (;;) {
      const set = await loadV2(testId)
      const next = set?.weeks.find((w) => !set.generated[w.weekId])
      if (!set || !next) return
      startedAt.set(`${testId}|${next.weekId}`, Date.now())
      const result = await (async () => {
        try {
          const notes = next.start ? await notesForWeeks(db, set.courseId, [next.start]) : []
          const req = await buildWeekRequest({ className: set.className, kind: set.kind, testTitle: set.testTitle, week: next, notes })
          return await fetchWeek(req, await getToken())
        } catch {
          // Never leave a week stuck on "Making cards": anything unexpected shows as a failure with Try again.
          return { error: 'failed' as const }
        }
      })()
      const latest = await loadV2(testId)
      if (!latest) return
      if (latest.createdAt !== set.createdAt) continue // remade meanwhile: start over on the new set
      if (!('error' in result)) {
        await save({
          ...latest,
          generated: { ...latest.generated, [next.weekId]: result },
          session: weekReady(latest.session, next.weekId, result.topics.map((t) => t.problems.length)),
        })
        continue
      }
      // Without sign-in, a key or quota, the other weeks would fail the same way: mark them all now.
      const stop = STOPPING.includes(result.error)
      const failing = stop ? latest.weeks.filter((w) => !latest.generated[w.weekId]) : [next]
      await save({
        ...latest,
        generated: { ...latest.generated, ...Object.fromEntries(failing.map((w) => [w.weekId, result])) },
        session: failing.reduce((s, w) => weekFailed(s, w.weekId), latest.session),
      })
      if (stop) return
    }
  } finally {
    running.delete(testId)
  }
}

export type StartArgs = Pick<StoredStudySet, 'testId' | 'courseId' | 'className' | 'testTitle' | 'kind' | 'weeks'>

/** Saves a fresh set for a test (replacing any old one) and starts making its weeks. */
export async function startStudySet(args: StartArgs, getToken: () => Promise<string | null>) {
  const { testId, courseId, className, testTitle, kind, weeks } = args
  await save({
    version: 2, testId, courseId, className, testTitle, kind, weeks,
    createdAt: new Date().toISOString(),
    session: startSession(weeks.map((w) => w.weekId)),
    generated: {},
  })
  void generateMissing(testId, getToken)
}

export function useStudySet(testId: string | null, getToken: () => Promise<string | null>) {
  const set = useLiveQuery(async () => (testId ? ((await load(testId)) ?? null) : null), [testId])

  return {
    /** undefined while loading, null when there's no set, 'old' for a set made by an older version. */
    set,
    /** Picks up weeks left unmade (the app was closed mid-way, or the student came back online). */
    resume() {
      if (testId) void generateMissing(testId, getToken)
    },
    async act(action: SessionAction) {
      const s = testId ? await loadV2(testId) : undefined
      if (!s) return
      const session =
        action === 'startProblems' ? startProblems(s.session)
        : action === 'skip' ? skip(s.session)
        : 'jump' in action ? jump(s.session, action.jump[0], action.jump[1])
        : answer(s.session, action.correct)
      if (session !== s.session) await save({ ...s, session })
    },
    /** Tries the weeks that failed again. */
    async retry() {
      const s = testId ? await loadV2(testId) : undefined
      if (!s) return
      const generated = Object.fromEntries(Object.entries(s.generated).filter(([, g]) => !isError(g)))
      const failed = s.session.weeks.filter((w) => w.status === 'error').map((w) => w.weekId)
      await save({ ...s, generated, session: retryWeeks(s.session, failed) })
      void generateMissing(s.testId, getToken)
    },
    /** Switches between worked problems and idea cards; the set is made again. */
    async setKind(kind: ClassKind) {
      const s = testId ? await loadV2(testId) : undefined
      if (s && s.kind !== kind) await startStudySet({ ...s, kind }, getToken)
    },
    /** Makes the set again from the same weeks. */
    async remake(testIdOverride?: string) {
      const id = testIdOverride ?? testId
      const s = id ? await loadV2(id) : undefined
      if (s) await startStudySet(s, getToken)
    },
  }
}
