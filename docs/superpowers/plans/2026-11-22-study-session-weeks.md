# Study Session v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn study sets into week-by-week sessions: per-topic lesson, then A–D problems with "I'm stuck" solutions (skips), math rendered with KaTeX.

**Architecture:** `shape.ts` gets the week request/response; the server prompt and route switch to weeks. `session.ts` is rewritten around weeks → topics with lesson/problems phases and skips. `mathText.ts` splits text into plain and `$…$` math parts for a small `MathText` component (KaTeX). The store generates per week; `StudySession` becomes option B, loaded lazily.

**Tech Stack:** as before + `katex` (and `@types/katex` if needed).

**Spec:** `docs/superpowers/specs/2026-11-22-study-session-weeks-design.md` (with `2026-11-22-ai-study-sets-design.md` for everything it doesn't change).

## Global Constraints

- Branch `feature/study-sets`; never push or merge without the author's OK.
- Rules: 3 right in a row learns; a miss = wrong answer or skip; 2 misses → lesson again; 8 problems without the streak → review, revisited once at the end.
- Copy (exact): "Try problems", "I'm stuck: show me how", "How to solve it", "Answer:", "Got it", "Counts as skipped: the streak starts over.", "Two misses in a row, so here's the idea again before more problems.", "Making cards…", "This study set was made with an older version. Make it again."
- Server: same sign-in check, 30/day limit (now per week request), key only on the server.
- Done = typecheck, lint, test, build pass.

## Review Focus

1. **Malformed LaTeX from Claude** (`$\frac{1}{$`): shows as plain text, never throws. Pinned in Task 3.
2. **Literal dollar signs** in English text ("costs $5 and $10"): not turned into math when the content isn't math-like. Pinned in Task 3 (only `$…$` without spaces right inside the delimiters counts as math).
3. **A week with zero usable topics** from Claude: that week errors with Try again; other weeks continue. Pinned in Task 1 (`cleanWeekSet` null) and the store.
4. **Jumping to a topic in a later week, then finishing it**: the session returns to the earliest unfinished topic, not stuck. Pinned in Task 2.
5. **Old v1 saved sets**: opening one shows the "older version" message, no crash. Pinned in Task 4.

---

### Task 1: Week request/response and the server prompt

**Files:** Modify `src/studySet/shape.ts` (+test), `server/studySet.ts` (+test), `server/claude.ts`.

**Produces:**
- `type Step = { label: string; work: string }`; `type Worked = { problem: string; steps: Step[]; answer: string }`
- `type Problem = { prompt: string; choices: string[]; correct: number; whyWrong: string[]; solution: { steps: Step[]; answer: string } }`
- `type Topic = { title: string; lesson: { overview: string; example: Worked }; problems: Problem[] }`; `type WeekSet = { topics: Topic[] }`
- `type WeekRequest = { className; kind; testTitle; week: { label: string; items: { title: string; hint: string }[] }; notes: NotePayload[] }`
- `WEEK_SCHEMA`, `cleanWeekSet(raw): WeekSet | null` (drop problems failing the old question rules or missing solution steps/answer; drop topics with no title, no lesson overview/example, or < 3 problems; null when no topic left), `validWeekRequest(v)`.
- Route `POST /api/study-set/week` (replaces `/topic`, same errors/limits); `makeGenerate` takes `WeekRequest`.
- Remove the old `TopicSet`/`TopicRequest`/`cleanTopicSet` once nothing uses them (Task 4).

- [ ] Tests first: `cleanWeekSet` keeps a good set; drops a problem without `solution.steps`; drops a topic left with 2 problems; null when no topics; `validWeekRequest` rejects missing `week.items`. Route tests move to `/week`.
- [ ] Implement; prompt: 1–3 topics named by idea (not assignment), lesson overview 2–4 sentences, one worked example, 6–8 problems, every formula in `$…$` LaTeX, plain text otherwise, code execution check for `problems`. `npx vitest run src/studySet server` passes.
- [ ] Commit `feat(studyset): week-based cards with lessons and worked solutions (server)`.

### Task 2: Session rules v2

**Files:** Rewrite `src/studySet/session.ts` (+test).

**Produces:** `type TopicPhase = 'lesson' | 'problems' | 'learned' | 'review'`; `type WeekState = { weekId: string; status: 'waiting' | 'ready' | 'error'; topics: TopicState[] }`; `type TopicState = { phase; problemCount; streak; misses; asked; problemIndex; revisited; again: boolean /* lesson shown after 2 misses */ }`; `type SessionState = { weeks: WeekState[]; current: { week: number; topic: number } | null; reviewPass: boolean; done: boolean }`.
Functions: `startSession(weekIds)`, `weekReady(s, weekId, problemCounts: number[])`, `weekFailed(s, weekId)`, `startProblems(s)`, `answer(s, correct)`, `skip(s)`, `jump(s, week, topic)`.

- [ ] Tests first: lesson → problems; 3 right learns and moves to the next topic, then the next week; wrong+skip → lesson with `again: true`; 8 asked → review; review pass once at the end then done; waiting week shows as current (`status: 'waiting'`) and a failed week is skipped; jump to a later topic, learn it, returns to the earliest unfinished; plain JSON.
- [ ] Implement; tests pass. Commit `feat(studyset): week-by-week session rules with lessons and skips`.

### Task 3: Math text

**Files:** Create `src/studySet/mathText.ts` (+test), `src/studySet/MathText.tsx`; `package.json` (`katex`).

**Produces:** `mathParts(text: string): ({ math: false; text: string } | { math: true; tex: string })[]`; `<MathText text={string} />` rendering math parts with `katex.renderToString(tex, { throwOnError: false })`.

- [ ] Tests first: `'Find $x^2$ now'` → text/math/text; `'$5 and $10'` stays one text part; `'$\\frac{1}{2}$'` math; unmatched `'$x'` stays text; empty string → [].
- [ ] Implement; commit `feat(studyset): render math with KaTeX`.

### Task 4: Store, confirm step and the session screen (option B)

**Files:** Modify `src/studySet/store.ts`, `client.ts` (+test: `buildWeekRequest`, `fetchWeek` to `/week`), `StudySession.tsx`, `src/map/TestPrepPanel.tsx` (confirm step lists weeks), `src/app/App.tsx` (lazy-load `StudySession`), `src/app/theme.css`.

- [ ] Client tests first (request shape, `/week` URL); implement store (per week, `version: 2`, v1 → older-version message), confirm step by week, session per spec option B with the rail; lazy import.
- [ ] Full checks pass; headless browser with a stand-in `/week` response: lesson → problems → wrong → stuck/Got it → lesson again → 3 right → next topic/week; jump via rail; math renders; dark/light/390.
- [ ] Real run: one MATH week and one ENGL week with the author's key; check the math renders and is correct; record cost.
- [ ] Commit `feat(studyset): week-by-week session with lessons and solutions under the problem`.
