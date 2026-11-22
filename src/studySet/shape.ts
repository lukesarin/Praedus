/** What the app sends for one topic and what comes back. Shared by the app and the feed helper server. */

export type Card = { front: string; back: string }
export type Question = { prompt: string; choices: string[]; correct: number; whyWrong: string[] }
export type TopicSet = { cards: Card[]; questions: Question[] }

export type NotePayload = { name: string; kind: 'pdf' | 'image' | 'text'; mime: string; /** base64, or the text itself */ data: string }
export type TopicRequest = {
  className: string
  kind: 'problems' | 'ideas'
  testTitle: string
  topic: { title: string; hint: string }
  notes: NotePayload[]
}

export type TopicError = 'signed-out' | 'not-configured' | 'limit' | 'bad-request' | 'bad-output' | 'failed' | 'offline'

/** Fewer than this many usable questions can't make a streak of 3 without repeats. */
export const MIN_QUESTIONS = 3

const str = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0
const strs = (v: unknown, n: number) => Array.isArray(v) && v.length === n && v.every((x) => typeof x === 'string')

/** JSON schema for Claude's structured output. Counts are asked for in the prompt (the API ignores length limits). */
export const TOPIC_SCHEMA = {
  type: 'object',
  properties: {
    cards: {
      type: 'array',
      items: {
        type: 'object',
        properties: { front: { type: 'string' }, back: { type: 'string' } },
        required: ['front', 'back'],
        additionalProperties: false,
      },
    },
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          prompt: { type: 'string' },
          choices: { type: 'array', items: { type: 'string' } },
          correct: { type: 'integer' },
          whyWrong: { type: 'array', items: { type: 'string' } },
        },
        required: ['prompt', 'choices', 'correct', 'whyWrong'],
        additionalProperties: false,
      },
    },
  },
  required: ['cards', 'questions'],
  additionalProperties: false,
} as const

/** Keeps only well-formed cards and questions; null when too little is left to study. */
export function cleanTopicSet(raw: unknown): TopicSet | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as { cards?: unknown; questions?: unknown }
  const cards = (Array.isArray(r.cards) ? r.cards : []).filter((c): c is Card => str(c?.front) && str(c?.back))
  const questions = (Array.isArray(r.questions) ? r.questions : []).filter(
    (q): q is Question =>
      str(q?.prompt) && strs(q?.choices, 4) && q.choices.every(str) && Number.isInteger(q?.correct) && q.correct >= 0 && q.correct <= 3 && strs(q?.whyWrong, 4),
  )
  if (cards.length < 1 || questions.length < MIN_QUESTIONS) return null
  return {
    cards: cards.map(({ front, back }) => ({ front, back })),
    questions: questions.map(({ prompt, choices, correct, whyWrong }) => ({ prompt, choices, correct, whyWrong })),
  }
}

export function validTopicRequest(v: unknown): v is TopicRequest {
  if (!v || typeof v !== 'object') return false
  const r = v as Partial<TopicRequest>
  return (
    str(r.className) &&
    (r.kind === 'problems' || r.kind === 'ideas') &&
    str(r.testTitle) &&
    str(r.topic?.title) &&
    typeof r.topic?.hint === 'string' &&
    Array.isArray(r.notes) &&
    r.notes.every((n) => str(n?.name) && ['pdf', 'image', 'text'].includes(n?.kind) && str(n?.mime) && typeof n?.data === 'string')
  )
}
