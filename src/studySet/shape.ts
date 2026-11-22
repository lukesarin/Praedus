/** What the app sends for one topic and what comes back. Shared by the app and the feed helper server. */

export type NotePayload = { name: string; kind: 'pdf' | 'image' | 'text'; mime: string; /** base64, or the text itself */ data: string }
export type TopicError = 'signed-out' | 'not-configured' | 'limit' | 'bad-request' | 'bad-output' | 'failed' | 'offline'

/** Fewer than this many usable questions can't make a streak of 3 without repeats. */
export const MIN_QUESTIONS = 3

const str = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0
const strs = (v: unknown, n: number) => Array.isArray(v) && v.length === n && v.every((x) => typeof x === 'string')

// ---------- v2: a week at a time, each topic with a lesson and worked problems ----------

export type Step = { label: string; work: string }
export type Worked = { problem: string; steps: Step[]; answer: string }
export type Problem = { prompt: string; choices: string[]; correct: number; whyWrong: string[]; solution: { steps: Step[]; answer: string } }
export type Topic = { title: string; lesson: { overview: string; example: Worked }; problems: Problem[] }
export type WeekSet = { topics: Topic[] }

export type WeekRequest = {
  className: string
  kind: 'problems' | 'ideas'
  testTitle: string
  week: { label: string; items: { title: string; hint: string }[] }
  notes: NotePayload[]
}

const STEP = {
  type: 'object',
  properties: { label: { type: 'string' }, work: { type: 'string' } },
  required: ['label', 'work'],
  additionalProperties: false,
} as const
const STEPS = { type: 'array', items: STEP } as const

/** JSON schema for one week. Counts are asked for in the prompt (the API ignores length limits). */
export const WEEK_SCHEMA = {
  type: 'object',
  properties: {
    topics: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          lesson: {
            type: 'object',
            properties: {
              overview: { type: 'string' },
              example: {
                type: 'object',
                properties: { problem: { type: 'string' }, steps: STEPS, answer: { type: 'string' } },
                required: ['problem', 'steps', 'answer'],
                additionalProperties: false,
              },
            },
            required: ['overview', 'example'],
            additionalProperties: false,
          },
          problems: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                prompt: { type: 'string' },
                choices: { type: 'array', items: { type: 'string' } },
                correct: { type: 'integer' },
                whyWrong: { type: 'array', items: { type: 'string' } },
                solution: {
                  type: 'object',
                  properties: { steps: STEPS, answer: { type: 'string' } },
                  required: ['steps', 'answer'],
                  additionalProperties: false,
                },
              },
              required: ['prompt', 'choices', 'correct', 'whyWrong', 'solution'],
              additionalProperties: false,
            },
          },
        },
        required: ['title', 'lesson', 'problems'],
        additionalProperties: false,
      },
    },
  },
  required: ['topics'],
  additionalProperties: false,
} as const

function cleanSteps(v: unknown): Step[] | null {
  if (!Array.isArray(v) || v.length === 0) return null
  const steps = v.filter((s): s is Step => typeof s?.label === 'string' && str(s?.work)).map(({ label, work }) => ({ label, work }))
  return steps.length ? steps : null
}

function cleanProblem(p: unknown): Problem | null {
  const q = p as Partial<Problem> | null
  if (!q || !str(q.prompt) || !strs(q.choices, 4) || !q.choices!.every(str) || !Number.isInteger(q.correct)) return null
  if (q.correct! < 0 || q.correct! > 3 || !strs(q.whyWrong, 4)) return null
  const steps = cleanSteps(q.solution?.steps)
  if (!steps || !str(q.solution?.answer)) return null
  return { prompt: q.prompt!, choices: q.choices!, correct: q.correct!, whyWrong: q.whyWrong!, solution: { steps, answer: q.solution!.answer } }
}

/** Keeps well-formed topics (a lesson and at least MIN_QUESTIONS good problems); null when none are left. */
export function cleanWeekSet(raw: unknown): WeekSet | null {
  const topicsIn = (raw as { topics?: unknown } | null)?.topics
  if (!Array.isArray(topicsIn)) return null
  const topics: Topic[] = []
  for (const t of topicsIn) {
    const ex = t?.lesson?.example
    const steps = cleanSteps(ex?.steps)
    if (!str(t?.title) || !str(t?.lesson?.overview) || !str(ex?.problem) || !steps || !str(ex?.answer)) continue
    const problems = (Array.isArray(t.problems) ? t.problems : []).map(cleanProblem).filter((p: Problem | null): p is Problem => p !== null)
    if (problems.length < MIN_QUESTIONS) continue
    topics.push({ title: t.title, lesson: { overview: t.lesson.overview, example: { problem: ex.problem, steps, answer: ex.answer } }, problems })
  }
  return topics.length ? { topics } : null
}

export function validWeekRequest(v: unknown): v is WeekRequest {
  if (!v || typeof v !== 'object') return false
  const r = v as Partial<WeekRequest>
  return (
    str(r.className) &&
    (r.kind === 'problems' || r.kind === 'ideas') &&
    str(r.testTitle) &&
    str(r.week?.label) &&
    Array.isArray(r.week?.items) &&
    r.week.items.every((i) => str(i?.title) && typeof i?.hint === 'string') &&
    Array.isArray(r.notes) &&
    r.notes.every((n) => str(n?.name) && ['pdf', 'image', 'text'].includes(n?.kind) && str(n?.mime) && typeof n?.data === 'string')
  )
}
