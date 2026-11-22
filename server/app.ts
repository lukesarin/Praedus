import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { Hono } from 'hono'
import { mountStudySet, type StudySetDeps } from './studySet'
import { hostOf, isAllowedFeedUrl, isPrivateAddress } from './validate'

/**
 * Stateless feed helper. Canvas doesn't let browsers read calendar feeds from other
 * sites (CORS), so the app asks this server to fetch them. Feed URLs act like
 * passwords: nothing here stores them, and logs only ever include the host.
 */

export type AppDeps = {
  fetch?: typeof globalThis.fetch
  resolve?: (host: string) => Promise<string[]>
  log?: (message: string) => void
  timeoutMs?: number
  maxBytes?: number
  /** The study set endpoint; left out, it isn't mounted. */
  studySet?: StudySetDeps
}

const MAX_REDIRECTS = 3

class FeedError extends Error {
  readonly status: 400 | 502 | 504
  constructor(status: 400 | 502 | 504, message: string) {
    super(message)
    this.status = status
  }
}

const defaultResolve = async (host: string) =>
  (await lookup(host, { all: true })).map((a) => a.address)

export function createApp(deps: AppDeps = {}) {
  const doFetch = deps.fetch ?? globalThis.fetch
  const resolve = deps.resolve ?? defaultResolve
  const log = deps.log ?? ((m: string) => console.log(m))
  const timeoutMs = deps.timeoutMs ?? 10_000
  const maxBytes = deps.maxBytes ?? 5 * 1024 * 1024

  async function assertSafe(raw: string, status: 400 | 502) {
    if (!isAllowedFeedUrl(raw)) {
      throw new FeedError(status, "That isn't a Canvas calendar feed link.")
    }
    const host = hostOf(new URL(raw))
    let addresses: string[]
    try {
      addresses = isIP(host) ? [host] : await resolve(host)
    } catch {
      throw new FeedError(502, `Couldn't find the server ${host}.`)
    }
    if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
      throw new FeedError(status, "That address isn't allowed.")
    }
  }

  async function readCapped(res: Response): Promise<string> {
    const declared = Number(res.headers.get('content-length') ?? 0)
    if (declared > maxBytes) throw new FeedError(502, 'The calendar is too large.')
    if (!res.body) return ''
    const reader = res.body.getReader()
    const chunks: Uint8Array[] = []
    let total = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > maxBytes) {
        await reader.cancel()
        throw new FeedError(502, 'The calendar is too large.')
      }
      chunks.push(value)
    }
    return new TextDecoder().decode(Buffer.concat(chunks))
  }

  async function fetchFeed(start: string, signal: AbortSignal): Promise<string> {
    let current = start
    await assertSafe(current, 400)
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const res = await doFetch(current, {
        redirect: 'manual',
        signal,
        headers: { accept: 'text/calendar, */*;q=0.5', 'user-agent': 'StudyBlocks feed helper' },
      })
      log(`[feed] ${hostOf(new URL(current))} -> ${res.status}`)

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location')
        if (!location) throw new FeedError(502, 'Canvas sent a broken redirect.')
        current = new URL(location, current).toString()
        await assertSafe(current, 502)
        continue
      }
      if (!res.ok) {
        throw new FeedError(502, `Canvas answered with an error (${res.status}). Check that the link is current.`)
      }
      const text = await readCapped(res)
      if (!/BEGIN:VCALENDAR/i.test(text.slice(0, 2048))) {
        throw new FeedError(502, "Canvas didn't send back a calendar. Check that the link is current.")
      }
      return text
    }
    throw new FeedError(502, 'Too many redirects.')
  }

  const app = new Hono()

  app.get('/api/health', (c) => c.json({ ok: true }))
  if (deps.studySet) mountStudySet(app, deps.studySet, log)

  app.get('/api/feed', async (c) => {
    const raw = c.req.query('url') ?? ''
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const text = await fetchFeed(raw, controller.signal)
      return c.body(text, 200, {
        'content-type': 'text/calendar; charset=utf-8',
        'cache-control': 'no-store',
      })
    } catch (err) {
      if (err instanceof FeedError) return c.json({ error: err.message }, err.status)
      if (controller.signal.aborted) return c.json({ error: 'Canvas took too long to answer.' }, 504)
      log(`[feed] unexpected error: ${(err as Error).name}`)
      return c.json({ error: "Couldn't reach Canvas." }, 502)
    } finally {
      clearTimeout(timer)
    }
  })

  return app
}
