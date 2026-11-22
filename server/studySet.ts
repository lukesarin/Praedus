import type { Hono } from 'hono'
import { cleanTopicSet, validTopicRequest, type TopicRequest } from '../src/studySet/shape'

export type StudySetDeps = {
  /** The signed-in user's id for a Supabase access token, or null. */
  verifyUser: (token: string) => Promise<string | null>
  /** Calls Claude; null when no API key is set up. */
  generate: ((req: TopicRequest) => Promise<unknown>) | null
  now?: () => Date
  dailyLimit?: number
}

/** Requests bigger than this can't fit in one Claude request with room to spare. */
const MAX_BODY_BYTES = 25 * 1024 * 1024

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

/** `POST /api/study-set/topic`: one topic's cards and questions, for signed-in students only. */
export function mountStudySet(app: Hono, deps: StudySetDeps, log: (m: string) => void) {
  const now = deps.now ?? (() => new Date())
  const limit = deps.dailyLimit ?? 30
  // Per user, per local day. In memory: resets when the server restarts (real limits come with going live).
  const used = new Map<string, number>()

  app.post('/api/study-set/topic', async (c) => {
    const token = /^Bearer (.+)$/.exec(c.req.header('authorization') ?? '')?.[1]
    const userId = token ? await deps.verifyUser(token).catch(() => null) : null
    if (!userId) return c.json({ error: 'signed-out' }, 401)
    if (!deps.generate) return c.json({ error: 'not-configured' }, 503)

    if (Number(c.req.header('content-length') ?? 0) > MAX_BODY_BYTES) return c.json({ error: 'bad-request' }, 400)
    const body = await c.req.json().catch(() => null)
    if (!validTopicRequest(body)) return c.json({ error: 'bad-request' }, 400)

    const key = `${userId}|${dayKey(now())}`
    const count = used.get(key) ?? 0
    if (count >= limit) return c.json({ error: 'limit' }, 429)
    used.set(key, count + 1)

    try {
      const set = cleanTopicSet(await deps.generate(body))
      return set ? c.json(set) : c.json({ error: 'bad-output' }, 502)
    } catch (e) {
      // Never log the request: it can hold the student's notes.
      log(`study set: generation failed (${e instanceof Error ? e.name : 'error'})`)
      return c.json({ error: 'failed' }, 502)
    }
  })
}
