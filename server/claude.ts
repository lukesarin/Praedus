import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { WEEK_SCHEMA, type WeekRequest } from '../src/studySet/shape'

const MODEL = 'claude-opus-5-5'

const COMMON = `You make study material for one week of a college class, for a student preparing for a test.
Write for a student, in plain language. Use only what's true. If the student's notes are given, they are
the main source: follow their wording, notation and emphasis, and stay within what they and the week's
assignments cover.

Formatting: plain text, no Markdown. Write every formula, variable, number with units in a formula, and
expression in LaTeX between single dollar signs, like $x^2 + y^2 = 100$, $\\frac{dy}{dt}$, $\\sqrt{x}$,
$\\pi r^2$. Never use a dollar sign for anything else (write "5 dollars", not a dollar sign).

Split the week into 1 to 3 topics, named by the idea (like "Related rates"), not by the assignment.
For each topic return:
- "lesson": an "overview" of 2 to 4 sentences explaining the idea and how to approach it, and one
  worked "example" ("problem", "steps" with a short "label" and the "work" for each step, and "answer").
- "problems": 6 to 8 multiple-choice problems like the ones on the test. Each has a "prompt", exactly 4
  "choices", "correct" as the index (0-3) of the one right choice, "whyWrong": 4 strings, one per choice,
  explaining the mistake behind that choice ("" for the correct one), and a "solution" worked step by
  step ("steps" with "label" and "work", then "answer"). Make wrong choices mistakes a real student would
  make. Vary which index is correct.`

const KIND = {
  problems: `This is a problem-solving class: lessons and problems are computations like the ones on the test.
Before writing any answer, work the problem with the code execution tool and make sure it's right.
Only include problems whose answer you checked that way.`,
  ideas: `This is a class about ideas, readings and facts: lessons explain the idea with one example, and
problems check understanding (applying the idea to a new case), not word-for-word recall. A "solution"
explains the reasoning in 2 to 4 short steps.`,
} as const

/** The user turn: the student's notes as documents/images/text, then the week. */
function content(req: WeekRequest): Anthropic.ContentBlockParam[] {
  const notes: Anthropic.ContentBlockParam[] = req.notes.map((n) =>
    n.kind === 'pdf'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: n.data }, title: n.name }
      : n.kind === 'image'
        ? { type: 'image', source: { type: 'base64', media_type: n.mime as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data: n.data } }
        : { type: 'text', text: `Student's note "${n.name}":\n${n.data}` },
  )
  const items = req.week.items.map((i) => `- ${i.title}${i.hint ? `: ${i.hint}` : ''}`).join('\n')
  const week = `Class: ${req.className}\nTest: ${req.testTitle}\n${req.week.label}. What was due:\n${items}
${req.notes.length ? 'Use the notes above as the main source.' : 'The student added no notes for this week; use standard material for these assignments.'}`
  return [...notes, { type: 'text', text: week }]
}

/** Calls Claude for one week and returns its parsed JSON (validated by the caller). */
export function makeGenerate(apiKey: string, onUsage?: (usage: Anthropic.Usage) => void) {
  const client = new Anthropic({ apiKey })
  return async (req: WeekRequest): Promise<unknown> => {
    const messages: Anthropic.MessageParam[] = [{ role: 'user', content: content(req) }]
    const tools: Anthropic.ToolUnion[] = req.kind === 'problems' ? [{ type: 'code_execution_20260521', name: 'code_execution' }] : []
    // Server tools can pause a long turn; resume by sending the turn back (at most a few times).
    for (let round = 0; round < 4; round++) {
      const msg = await client.messages
        .stream({
          model: MODEL,
          max_tokens: 32000,
          system: `${COMMON}\n\n${KIND[req.kind]}`,
          messages,
          tools,
          output_config: { effort: 'medium', format: { type: 'json_schema', schema: WEEK_SCHEMA } },
        })
        .finalMessage()
      onUsage?.(msg.usage)
      if (msg.stop_reason === 'pause_turn') {
        messages.push({ role: 'assistant', content: msg.content })
        continue
      }
      if (msg.stop_reason === 'refusal') throw new Error('refused')
      if (msg.stop_reason === 'max_tokens') throw new Error('too long')
      const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('')
      return JSON.parse(text)
    }
    throw new Error('did not finish')
  }
}

/** Checks a Supabase access token and returns its user id. */
export function makeVerifyUser(url: string, publishableKey: string) {
  const supabase = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } })
  return async (token: string): Promise<string | null> => {
    const { data, error } = await supabase.auth.getUser(token)
    return error ? null : (data.user?.id ?? null)
  }
}
