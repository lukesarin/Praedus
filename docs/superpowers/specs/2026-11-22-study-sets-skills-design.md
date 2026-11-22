# Study sets v3: skills, made as you go — design

Status: **approved by the author, not built yet** (2026-11-22). Next session: start with the quality gate, then a build plan.
Replaces the generation and unit of study in `2026-11-22-study-session-weeks-design.md`. Everything
else stands as built: notes, the sign-in check, the key on the server, KaTeX, "I'm stuck" (solution
under the problem, counts as skipped), the waiting screen, Plan review time.

## Intent

The author built a real midterm practice test (`66_Problem_Transformations_and_Sinusoidal_Test.pdf`):
**8 parts, 66 named skills**, one 4-choice question each ("Shifting points on a graph", "Factoring to
find the phase shift"…). The current study sets are far coarser (about 2 topics a week, 6–8 problems
each) and felt too brief. A study set should drill **every specific skill** until the student gets
**3 in a row**, at a cost that stays low, without losing question quality.

Success: for a test like that midterm, a student practices all 66 skills, each with its own short
lesson and fresh problems, for **about $1.30 per test** in API cost (≈$1 for problems + ≈30¢ for 66
lessons on Opus), with answers that are right.

Anti-goals: wrong answers; near-duplicate or giveaway problems; long waits between problems; a bill
that grows with every retry.

## Approaches (cost for the 66-skill midterm, from two real runs scaled)

| Approach | What you get | Cost per test | Decision |
|---|---|---|---|
| Current app | ~16 broad topics, ~110 problems made up front | ~$1.60 | Too coarse |
| 66 skills, all on Opus | 66 skills, ~300 problems made as needed | ~$3 ($2–5) | Same quality, 3× the cost |
| **66 skills, Opus plans + Haiku repeats** | Same as above | **~$1.30 ($1–1.60)** with 66 short lessons | **Chosen**, pending the quality check below |

## Design

### Structure of a set
Test → **parts** (about 5–10, like "Reflections") → **skills** (about 3–10 per part, 40–80 total,
each named like the author's) → **problems** (4 choices, why each wrong choice is wrong, worked
solution). **Every skill has its own short lesson** (the author's decision: 66 short ones for the
midterm, not one per part): 1–3 sentences on the idea, then one worked example. That worked example
is also the skill's **model problem** that Haiku copies.

### Who writes what
1. **Skill map (Opus, one fast request):** reads the student's notes for the covered weeks and the
   weeks' assignments; returns the parts and skills with a one-line description each. When a note is
   a practice test or study guide, its parts and skills are the map. About 20–40 seconds.
2. **Part pack (Opus, one request per part, first part first):** for every skill in the part, its
   short lesson and worked example (the model problem), every math answer checked with code execution. The rest of the parts are made
   in the background while the student studies (like weeks today).
3. **Practice problems (Haiku, on demand):** "same skill, same style, new numbers/details as this
   model problem", 3 per skill to start; when a student misses or skips, 2 more for that skill in the
   background before they're needed. Math answers checked with code execution; a problem that fails
   the check is dropped. Haiku gets only the skill, its lesson and model problem, and the skill's
   earlier problems (so it doesn't repeat them), not the notes (smaller, cheaper requests).
4. **Fallback:** if the quality check shows Haiku is weak for idea-based skills ("Which description
   best fits a sinusoidal function?"), those skills use Sonnet instead (+30–50¢ per test).

### Cost controls
- Problems are made as needed: easy skills never cost more than 3 problems.
- The notes are sent with prompt caching in the Opus requests, so a long PDF is paid for about once
  per set, not once per part.
- Tight writing: one sentence per wrong choice, 2–4 solution steps (output is most of the cost).
- Server limits per user per day: 5 new sets, 400 practice problems. Plain message when reached.
- Later (needs cloud save): students in the same section and test share one skill map and problem
  bank, so cost per student approaches zero.

### The session
- Rail: parts, each with its skills (learned mint dot, current highlighted, "Making problems…").
- Parts in order; within a part, skills in order. Per skill: its short lesson → **Try problems** →
  problems until **3 right in a row** (learned), then the next skill's lesson. A miss is a wrong answer
  or "I'm stuck" + Got it.
- **2 misses on a skill** bring that skill's lesson back ("Two misses in a row, so here's the idea
  again before more problems.") before more problems. **8 problems** without the streak → "Needs review", back once at the end.
- Waiting screen (option B) for the first part; "Making more problems…" is rarely seen because
  top-ups start right after the first miss.
- End screen as built: skills learned out of total, the review list, Plan review time.

### Quality gate before building
Run part "Reflections" (6 skills, number-based and idea-based) twice, all-Opus vs Opus + Haiku,
shuffle and show the author both sets unlabeled. Ship the recommended split only if the author can't
tell them apart or prefers it; otherwise use Sonnet for the repeats. Budget: under 25¢.

## Risks
- Haiku near-duplicates on idea-based skills (mitigation: Sonnet for those; "make them different
  from these" with the skill's earlier problems listed).
- A wrong answer slipping through on non-numeric math (mitigation: code check where possible; the
  model problem and lesson stay on Opus).
- PDFs with missing characters (the author's test shows "x■" for x⁴): Claude may misread those
  questions; the skill map should say when a note looks garbled.

## Not in this version
Sharing banks between students (needs cloud save), spaced repetition across days, Batch API.

## Decisions log (2026-11-22, in chat)

- Unit of study = **specific skills** like the author's practice test, not broad weekly topics (the
  current topics "felt way too brief").
- Mastery stays **3 right in a row**, per skill.
- Generation: **Opus plans + writes lessons and model problems; Haiku writes practice copies**, made as
  needed. Sonnet is the fallback if Haiku's copies are weak.
- **One short lesson per skill** (66 for the midterm), not one per part.
- Nothing is built yet; the author said "don't build anything" and to save this for the next session.

## The author's midterm (reference: `docs/reference/66_Problem_Transformations_and_Sinusoidal_Test.pdf`)

"Math Practice Test: Graph Transformations, Symmetry & Sinusoidal Functions", 66 questions, 4 choices
each, answer under each. Parts and skill numbers:
1. Horizontal & vertical shifts (1–6): shifting right/left/up/down, combining shifts, shifting points.
2. Stretching & compressing (7–13): vertical/horizontal stretch and compression, scaling points, combined scaling.
3. Reflections (14–19): across x-axis, y-axis, both axes; reflecting points across each axis; combined reflections, shifts and scaling.
4. Even & odd functions (20–29): identifying even/odd/neither algebraically, the even/odd rules, their symmetry, using points, both even and odd.
5. General graph symmetry (30–32): x-axis symmetry, origin symmetry, testing symmetry algebraically.
6. Sinusoidal functions & standard form (33–42): meaning, parent sine/cosine, standard form, parameters A/B/C/D, starting values, parent period.
7. Amplitude, midline & period (43–55): amplitude and midline from equation or max/min, period formula, compression/stretch and period, degrees, effects of shifts/scaling, max/min, range, period from peaks.
8. Multiple combined transformations (56–66): reflection + stretch, phase shift right/left, combined features, factoring for phase shift, transforming a point, writing an equation from features, combined point mapping, modeling from max/min/period.

Note: in that PDF, questions 20, 21, 29, 30, 31, 35 and 36 show "x■" where exponents (x⁴, x⁵) were
lost by the font. Use a cleaner copy for the quality gate, or tell Claude the ■ are missing exponents.

## Handoff for the next session

**What exists now** (branch `auth/accounts`, pushed): study sets v2, built and working.
- `server/claude.ts`: one Opus request per **week** (`POST /api/study-set/week`), `WEEK_SCHEMA`
  in `src/studySet/shape.ts` (topics → lesson + 6–8 problems), code execution for problem classes,
  LaTeX in `$…$`, usage callback for cost.
- `src/studySet/weekSession.ts`: rules (weeks → topics; lesson → problems; 3 in a row; 2 misses →
  lesson; 8 → review; review pass; jump; retryWeeks), with tests.
- `src/studySet/store.ts`: `StoredStudySet` v2 in Dexie `studySets`, generation per week in order,
  `generatingSince` for the waiting timer; `client.ts` request building and errors; `StudySession.tsx`
  (rail, lesson, problem view option B, waiting screen option B, end screen); `MathText` (KaTeX).
- Confirm step in `src/map/TestPrepPanel.tsx` lists weeks (`studyWeeks` in `panelText.ts`).

**What changes for v3** (plan it with superpowers:writing-plans after the quality gate):
1. `shape.ts`: new request/response types for (a) the skill map (parts → skills with a one-line
   description) and (b) a part pack (per skill: lesson, model problem) and (c) practice problems for
   one skill; validators like `cleanWeekSet`.
2. `server/`: three endpoints (map, part pack, practice), models per endpoint (Opus, Opus, Haiku with
   Sonnet fallback), prompt caching for notes, new daily limits (5 sets, 400 practice problems).
3. `weekSession.ts` → a skill-level session (parts → skills; per skill lesson → problems; problems
   arrive over time per skill). Keep it pure and tested like the current one.
4. `store.ts`: generate map → part packs in order → practice problems on demand (3 per skill, +2
   after a miss, before they're needed); saved as `version: 3` (older sets show the "older version"
   message, as v1 does now).
5. `StudySession.tsx`: rail of parts → skills; lesson per skill; "Making problems…" only if a top-up
   is late. Confirm step can stay by week (the map is built from those weeks' notes and assignments).

**First step next session:** the quality gate. Generate part 3 "Reflections" (skills 14–19) with
all-Opus and with Opus model problems + Haiku copies; show both sets unlabeled; record the cost of
each. Then write the plan.

