# AI study sets — design

Status: draft for the author's approval · Date: 2026-11-22
Builds on: `2026-11-22-study-map-donut-design.md` (the study set step, now a placeholder) and
`2026-11-22-study-map-week-card-design.md`. Preview for notes: `design-exploration/notes.html`, option **A**.
Branch: `auth/accounts` (needs signed-in students).

## Intent

Before a test, a student should be able to turn the weeks it covers into a study session that
actually teaches them and checks that they can do it. Classes differ in what's on the cards: math
and CS need worked problems, English and history need ideas and examples. The quality of the cards
depends on the student's own material, so adding notes has to be effortless.

Success: a student picks Test 3, confirms topics, and within a minute is studying cards built from
their own notes. A topic only counts as learned after they answer questions correctly on their own.

Anti-goals: a tool that teaches wrong answers; adding notes week by week; an API key anyone can use
or run up; a "mastery" score students can't understand.

## Approaches

| Decision | Options considered | Picked |
|---|---|---|
| Study format | Multiple choice only · flashcards per class type · **flashcards for every class, then a multiple-choice check** | Flashcards + check (author) — reading a solution feels easier than doing one, so the check proves it |
| Learning a topic | Hidden algorithm · **visible rule: 3 correct in a row** | Visible rule (author agreed) |
| Student material | Topics only · paste box · **one notes drop area per class, sorted into weeks, PDFs/photos/paste** | Drop area (author), placement option A from the preview |
| Where Claude is called | **Feed helper server endpoint** · Supabase Edge Function | Feed helper (author) — one server, simple locally, moves to Vercel with project 3 |

## Design

### 1. Notes (per class)

- A dashed drop area at the top of the study map panel: "Drop notes for MATH 120 — Slides, study
  guides, photos of notes. Or paste with ⌘V. They sort into weeks on their own." plus **Choose
  files**. After notes exist, a line under it: "6 notes, in weeks 9, 10, 11, 12, 13".
- Accepts several files at once: PDF (slides exported as PDF included), images (JPEG/PNG/HEIC→
  converted or rejected with a plain message), and pasted text. Other types get "Export it as PDF
  first." Max 20 MB per file (Claude's request limit is 32 MB; leave room).
- **Sorting into weeks:** a note goes into the week of the file's date (`lastModified`) when that
  date is inside the class's weeks; otherwise into the current week. A toast says where each went,
  and those week slices flash once. In the week card, under "Your notes", each note can be moved to
  another week or deleted (small menu).
- Weeks with notes show a small page mark beside their number on the donut.
- Storage: a new Dexie table `notes` in the account's database (`id, courseId, week (Monday
  key), name, kind ('pdf'|'image'|'text'), blob or text, addedAt`). Student-owned; feed syncs never
  touch it. Moves to the cloud with project 2.

### 2. Making a study set

- The existing study set step keeps its topic chips and "Add a topic", and adds a line: "Also uses
  your 3 notes from weeks 9–13" (or "No notes for these weeks yet. Cards will come from the topics
  alone.") with "+ Add notes for this test".
- **Create study set** becomes active (the Premium line is removed for now; Premium gating comes
  with going live). Clicking it opens the study session and generation starts.
- Class type decides card content: **problem classes** (subject code MATH, STAT, CS, CSE, PHYS,
  CHEM, ECON, ENGR and similar — a fixed list in code) vs **idea classes** (everything else). The
  student can switch it from the session header ("Cards: worked problems / ideas").

### 3. The study session

A full-screen view over the app (Esc or "Leave" returns; progress is kept).

- Topics run in order. Each topic has two phases:
  1. **Cards.** 4–6 flashcards. Front: a question (idea classes) or a problem (problem classes).
     Tap or Space to flip: the answer and why, or the full worked solution step by step. Then
     **Got it** / **Again**. "Again" cards come back at the end of the topic's cards; the phase ends
     when every card has had "Got it" once.
  2. **Check.** Multiple-choice questions, 4 choices each. A correct answer adds a dot to the
     streak; **3 in a row** and the topic is learned. A wrong answer shows why that choice is wrong
     (each wrong choice carries its own explanation) and resets the streak; after 2 wrong answers
     in the check, the topic's cards are shown again before more questions. After **8 questions**
     without a streak of 3, the topic is marked "Needs review" and the session moves on; those
     topics come back once at the end.
- Progress shows as one row of topics with their state (learned, needs review, not started).
- End screen: topics learned, topics to review, and **Plan review time** (existing planner) for
  the ones to review.
- Saved per test in a Dexie table `studySets` (topics, generated cards/questions, per-topic state),
  so leaving and coming back resumes, and making the set again isn't needed (a "Make it again"
  button regenerates).

### 4. Generation (server)

- New endpoint on the feed helper: `POST /api/study-set/topic`, one call per topic so the first
  topic is ready quickly and the rest generate in the background while the student studies.
- Request: class name, class type, the test's title, the topic (title + Canvas description), and
  the notes for the covered weeks (PDFs as document blocks, images as image blocks, text as text).
- **Auth:** requires `Authorization: Bearer <Supabase access token>`; the server verifies it with
  Supabase (`auth.getUser(token)`), else 401. Per-user limit: 30 topic generations per day (in
  memory for now), plain error when reached.
- **Key:** `ANTHROPIC_API_KEY` in `.env.local`, read only by the server (never `VITE_`). The app
  shows "AI study sets aren't set up on this computer" when the endpoint says the key is missing.
- Claude call: Anthropic TypeScript SDK, model `claude-opus-5-5`, structured output (JSON schema:
  `cards[{front, back}]`, `questions[{prompt, choices[4], correct, whyWrong[4]}]`), streaming with
  the final message. Default effort `medium`.
- **Correct answers for problem classes:** Claude works each question with the code execution
  tool before writing it, and the prompt requires every answer to be checked that way. If a check
  fails, the question is dropped rather than shown.
- Errors: a refusal or failure for one topic marks it "Couldn't make cards for this topic" with
  Try again; other topics continue.

### 5. Cost and limits (for the author)

Per topic, roughly 2–10k input tokens (more with PDFs) and 3–5k output. With Opus 5.5 ($4/$20 per
million) that's about $0.05–0.15 per topic, so $0.30–1.00 for a 7-topic test. Switching the model to
Haiku 5.5 would cut that by ~40×; that's a one-line change and the author's call after trying it.

## Left to the builder

Exact prompt wording; card/question counts within the ranges; the session's layout (follow the
Hairline style: quiet surfaces, 1px rules, mint for learned/streak); how images are downscaled before
upload; the subject-code list; keyboard shortcuts (Space flip, 1/2 Got it/Again, A–D answers).

## Not in this version

Saving notes or study sets to the cloud (project 2), Premium gating and real usage limits (project
3), PowerPoint/Word files, sharing study sets, spaced repetition across days.
