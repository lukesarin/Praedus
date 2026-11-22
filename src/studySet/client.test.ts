import { describe, expect, it } from 'vitest'
import type { Note } from '../db/db'
import { buildTopicRequest, errorText, fetchTopic } from './client'

const note = (o: Partial<Note>): Note => ({ id: 'n', courseId: 'c', week: '2026-11-16', name: 'n', kind: 'pdf', mime: 'application/pdf', addedAt: '', ...o })
const topic = { id: 't', title: 'Problem Set 8', hint: 'Sections 2.5' }

describe('buildTopicRequest', () => {
  it('sends PDFs as base64, keeps their type, and sends text notes as text', async () => {
    const req = await buildTopicRequest({
      className: 'MATH 120 Calculus I', kind: 'problems', testTitle: 'Test 3', topic,
      notes: [note({ name: 'a.pdf', blob: new Blob(['%PDF-1']) }), note({ name: 'p', kind: 'text', mime: 'text/plain', text: 'chain rule' }),
        note({ name: 'b.txt', kind: 'text', mime: 'text/plain', blob: new Blob(['from a file']) })],
    })
    expect(req.topic).toEqual({ title: 'Problem Set 8', hint: 'Sections 2.5' })
    expect(req.notes).toEqual([
      { name: 'a.pdf', kind: 'pdf', mime: 'application/pdf', data: btoa('%PDF-1') },
      { name: 'p', kind: 'text', mime: 'text/plain', data: 'chain rule' },
      { name: 'b.txt', kind: 'text', mime: 'text/plain', data: 'from a file' },
    ])
  })
})

describe('unreadable notes', () => {
  it('skips a note whose file can no longer be read', async () => {
    const broken = { arrayBuffer: () => Promise.reject(new Error('NotFoundError')), text: () => Promise.reject(new Error('NotFoundError')) } as unknown as Blob
    const req = await buildTopicRequest({
      className: 'x', kind: 'ideas', testTitle: 't', topic,
      notes: [note({ name: 'gone.pdf', blob: broken }), note({ name: 'p', kind: 'text', mime: 'text/plain', text: 'ok' })],
    })
    expect(req.notes.map((n) => n.name)).toEqual(['p'])
  })
})

describe('fetchTopic', () => {
  const req = { className: 'x', kind: 'ideas' as const, testTitle: 't', topic: { title: 'a', hint: '' }, notes: [] }
  const reply = (status: number, body: unknown) => async () => new Response(JSON.stringify(body), { status })
  it('sends the sign-in token and returns the set', async () => {
    let auth = ''
    const set = { cards: [], questions: [] }
    const out = await fetchTopic(req, 'tok', async (_url, init) => {
      auth = new Headers(init?.headers).get('authorization') ?? ''
      return new Response(JSON.stringify(set), { status: 200 })
    })
    expect(auth).toBe('Bearer tok')
    expect(out).toEqual(set)
  })
  it('turns failures into plain error codes', async () => {
    expect(await fetchTopic(req, null, reply(401, { error: 'signed-out' }))).toEqual({ error: 'signed-out' })
    expect(await fetchTopic(req, 'tok', reply(503, { error: 'not-configured' }))).toEqual({ error: 'not-configured' })
    expect(await fetchTopic(req, 'tok', reply(429, { error: 'limit' }))).toEqual({ error: 'limit' })
    expect(await fetchTopic(req, 'tok', reply(502, { error: 'bad-output' }))).toEqual({ error: 'bad-output' })
    expect(await fetchTopic(req, 'tok', reply(500, 'oops'))).toEqual({ error: 'failed' })
    expect(await fetchTopic(req, 'tok', async () => { throw new TypeError('Failed to fetch') })).toEqual({ error: 'offline' })
  })
  it('says each error in plain words', () => {
    expect(errorText('signed-out')).toBe('Sign in again to make cards.')
    expect(errorText('not-configured')).toBe("AI study sets aren't set up on this computer.")
    expect(errorText('limit')).toBe("You've made a lot of cards today. Try again tomorrow.")
    expect(errorText('offline')).toBe("You're offline. Cards will be made when you're back.")
    expect(errorText('failed')).toBe("Couldn't make cards for this topic.")
  })
})
