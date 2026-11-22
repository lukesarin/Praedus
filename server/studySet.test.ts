import { describe, expect, it } from 'vitest'
import { createApp } from './app'
import type { StudySetDeps } from './studySet'

const good = { cards: [{ front: 'f', back: 'b' }], questions: Array(3).fill({ prompt: 'p', choices: ['a', 'b', 'c', 'd'], correct: 0, whyWrong: ['', 'x', 'y', 'z'] }) }
const body = { className: 'MATH 120', kind: 'problems', testTitle: 'Test 3', topic: { title: 'PS 8', hint: '' }, notes: [] }

function setup(over: Partial<StudySetDeps> = {}) {
  let today = new Date(2026, 10, 22, 12)
  const deps: StudySetDeps = {
    verifyUser: async (t) => (t === 'tok-a' ? 'user-a' : t === 'tok-b' ? 'user-b' : null),
    generate: async () => good,
    now: () => today,
    ...over,
  }
  const app = createApp({ studySet: deps })
  const call = (token: string | null, payload: unknown = body) =>
    app.request('/api/study-set/topic', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(payload),
    })
  return { call, setDay: (d: Date) => (today = d) }
}

describe('POST /api/study-set/topic', () => {
  it('needs a signed-in student', async () => {
    const { call } = setup()
    expect((await call(null)).status).toBe(401)
    const res = await call('expired')
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'signed-out' })
  })
  it('says when no key is set up', async () => {
    const res = await setup({ generate: null }).call('tok-a')
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'not-configured' })
  })
  it('returns the cleaned set', async () => {
    const res = await setup().call('tok-a')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(good)
  })
  it('limits each student to 30 a day', async () => {
    const { call, setDay } = setup()
    for (let i = 0; i < 30; i++) expect((await call('tok-a')).status).toBe(200)
    const over = await call('tok-a')
    expect(over.status).toBe(429)
    expect(await over.json()).toEqual({ error: 'limit' })
    expect((await call('tok-b')).status).toBe(200)
    setDay(new Date(2026, 10, 23, 9))
    expect((await call('tok-a')).status).toBe(200)
  })
  it('rejects a malformed request', async () => {
    const res = await setup().call('tok-a', { className: 'x' })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'bad-request' })
  })
  it('reports unusable output and failures', async () => {
    const junk = await setup({ generate: async () => ({ cards: [] }) }).call('tok-a')
    expect(junk.status).toBe(502)
    expect(await junk.json()).toEqual({ error: 'bad-output' })
    const boom = await setup({ generate: async () => { throw new Error('down') } }).call('tok-a')
    expect(boom.status).toBe(502)
    expect(await boom.json()).toEqual({ error: 'failed' })
  })
})
