import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { TOPIC_SCHEMA, type TopicRequest } from '../src/studySet/shape'

const MODEL = 'claude-opus-5-5'

const COMMON = `You make study material for one topic of a college class, for a student preparing for a test.
Write for a student, in plain language. Use only what's true; if the student's notes are given, follow
their wording, notation and emphasis, and stay within what the notes and the topic cover.

Return JSON with:
- "cards": 4 to 6 flashcards ("front" and "back").
- "questions": 8 multiple-choice questions on the same material, each with exactly 4 "choices",
  "correct" as the index (0-3) of the one right choice, and "whyWrong": 4 strings, one per choice,
  explaining why that choice is wrong (use "" for the correct choice). Make the wrong choices
  mistakes a real student would make. Vary which index is correct.`

const KIND = {
  problems: `This is a problem-solving class. Each card's front is a problem to solve, like one on the test.
Its back is the full worked solution, step by step, with a short reason for each step, ending with the answer.
Questions are problems too; each choice is a possible final answer.
Before writing any answer, work the problem with the code execution tool and make sure the answer is right.
Only include questions whose correct answer you checked that way.`,
  ideas: `This is a class about ideas, readings and facts. Each card's front asks about one idea (a term, a
claim, a passage, an event). Its back answers it in 2-4 sentences: what it means, then one example.
Questions check understanding, not word-for-word recall.`,
} as const

/** The user turn: the student's notes as documents/images/text, then the topic. */
function content(req: TopicRequest): Anthropic.ContentBlockParam[] {
  const notes: Anthropic.ContentBlockParam[] = req.notes.map((n) =>
    n.kind === 'pdf'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: n.data }, title: n.name }
      : n.kind === 'image'
        ? { type: 'image', source: { type: 'base64', media_type: n.mime as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data: n.data } }
        : { type: 'text', text: `Student's note "${n.name}":\n${n.data}` },
  )
  const topic = `Class: ${req.className}\nTest: ${req.testTitle}\nTopic: ${req.topic.title}${req.topic.hint ? `\nFrom Canvas: ${req.topic.hint}` : ''}
${req.notes.length ? 'Use the notes above as the main source.' : 'The student added no notes for these weeks; use standard material for this topic.'}`
  return [...notes, { type: 'text', text: topic }]
}

/** Calls Claude for one topic and returns its parsed JSON (validated by the caller). */
export function makeGenerate(apiKey: string) {
  const client = new Anthropic({ apiKey })
  return async (req: TopicRequest): Promise<unknown> => {
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
          output_config: { effort: 'medium', format: { type: 'json_schema', schema: TOPIC_SCHEMA } },
        })
        .finalMessage()
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
