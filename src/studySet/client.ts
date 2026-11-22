import type { Note } from '../db/db'
import type { StudySetTopic } from '../map/panelText'
import type { ClassKind } from './classType'
import type { NotePayload, TopicError, TopicRequest, TopicSet } from './shape'

/** Claude takes images up to about 5 MB; phone photos are often bigger, so they're shrunk first. */
const MAX_IMAGE_SIDE = 2000

async function base64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let out = ''
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(out)
}

/** A big photo, redrawn at most 2000 px on its longest side as JPEG. Browsers only; elsewhere unchanged. */
async function shrinkImage(blob: Blob): Promise<{ blob: Blob; mime: string } | null> {
  if (typeof createImageBitmap !== 'function' || typeof OffscreenCanvas !== 'function') return null
  const bitmap = await createImageBitmap(blob)
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height))
  if (scale === 1 && blob.size < 3_500_000) return null
  const canvas = new OffscreenCanvas(Math.round(bitmap.width * scale), Math.round(bitmap.height * scale))
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return { blob: await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 }), mime: 'image/jpeg' }
}

async function payload(n: Note): Promise<NotePayload> {
  if (n.kind === 'text') return { name: n.name, kind: 'text', mime: n.mime, data: n.text ?? (await n.blob?.text()) ?? '' }
  if (n.kind === 'image' && n.blob) {
    const small = await shrinkImage(n.blob).catch(() => null)
    if (small) return { name: n.name, kind: 'image', mime: small.mime, data: await base64(small.blob) }
  }
  return { name: n.name, kind: n.kind, mime: n.mime, data: n.blob ? await base64(n.blob) : '' }
}

export async function buildTopicRequest(args: {
  className: string
  kind: ClassKind
  testTitle: string
  topic: StudySetTopic
  notes: Note[]
}): Promise<TopicRequest> {
  return {
    className: args.className,
    kind: args.kind,
    testTitle: args.testTitle,
    topic: { title: args.topic.title, hint: args.topic.hint },
    // A note whose file can't be read anymore is left out rather than stopping the whole set.
    notes: (await Promise.all(args.notes.map((n) => payload(n).catch(() => null)))).filter((n): n is NotePayload => n !== null),
  }
}

const KNOWN: TopicError[] = ['signed-out', 'not-configured', 'limit', 'bad-request', 'bad-output', 'failed']

/** Asks the feed helper for one topic's cards and questions. */
export async function fetchTopic(
  req: TopicRequest,
  token: string | null,
  fetcher: typeof fetch = fetch,
): Promise<TopicSet | { error: TopicError }> {
  let res: Response
  try {
    res = await fetcher('/api/study-set/topic', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(req),
    })
  } catch {
    return { error: 'offline' }
  }
  const body = await res.json().catch(() => null)
  if (res.ok && body) return body as TopicSet
  const code = body?.error
  return { error: KNOWN.includes(code) ? code : 'failed' }
}

export function errorText(code: TopicError): string {
  switch (code) {
    case 'signed-out': return 'Sign in again to make cards.'
    case 'not-configured': return "AI study sets aren't set up on this computer."
    case 'limit': return "You've made a lot of cards today. Try again tomorrow."
    case 'offline': return "You're offline. Cards will be made when you're back."
    default: return "Couldn't make cards for this topic."
  }
}
