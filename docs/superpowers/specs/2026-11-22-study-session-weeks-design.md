# Study session v2: week by week, lessons, flip when stuck — design (short)

Status: decided by the author in chat (preview `design-exploration/study-session.html`, option **B**) · Date: 2026-11-22
Replaces section 3 (the session) and changes section 4 (generation) of `2026-11-22-ai-study-sets-design.md`.
Notes, the drop area, the server's sign-in check, limits and key handling stand as built.

## Intent

The first version split a test by assignment and had separate flashcards and a quiz. Trying it, the
author wants: sections by **week**; **real math formatting**; one kind of card, a **problem with choices
A–D** that you can **flip when stuck** to see it solved (counts as skipped); and a **short lesson**
before each topic's problems.

## Approaches

| Decision | Options | Picked |
|---|---|---|
| Unit of the set | by assignment · **by week, split into Claude-named topics** | By week (author) |
| Math display | plain text (x^2) · **LaTeX rendered with KaTeX** | KaTeX (author asked for real exponents; KaTeX is the standard, bundled, offline) |
| Stuck | guess · **flip to the worked solution, counts as skipped** | Flip (author) |
| Where the solution shows | A real flip · **B opens underneath** · C side by side | B (author) — problem stays visible while following the steps |
| Order | pick a week · **week by week** | Week by week (author); the rail still lets you jump |

## Design

- **Confirm step:** lists the covered weeks ("Week 10: Problem Set 8, Quiz 3") as removable rows, plus
  the notes line as built. "Add a topic" adds a row "Your topics: …" studied after the weeks.
- **Generation:** one request per week (first week first, the rest in the background). Input: class,
  test, week label, that week's assignments (title + Canvas hint), that week's notes. Output: 1–3
  topics, each with a **lesson** (2–4 sentence overview + one worked example: problem, steps, answer)
  and 6–8 **problems** (prompt, 4 choices, correct, why each wrong choice is wrong, and a worked
  solution: steps + answer). All text may contain math as LaTeX between `$…$`; the server prompt asks
  for LaTeX for every formula, plain words otherwise, and code execution to check problem-class answers.
- **Session:** left rail of weeks → topics (learned mint dot, current highlighted, "Making cards…" for
  weeks not ready; click a ready topic to jump). Per topic: **lesson** → **Try problems** → problems.
  Choosing an answer: right adds a streak dot; wrong shows that choice's "why" and resets the streak.
  **"I'm stuck: show me how"** opens the worked solution under the problem and marks the right choice;
  **Got it** = skipped (resets the streak). **3 right in a row** learns the topic. **2 misses** (wrong or
  skipped) bring the lesson back with "Two misses in a row, so here's the idea again before more
  problems." **8 problems** without the streak → "Needs review", revisited once at the end. A week is
  done when all its topics are learned or marked for review; then the next week.
- **End screen** as built (learned count, review list, Plan review time, Make it again, failures + Try again).
- **Math:** `katex` bundled; the session screen is loaded only when opened (lazy), so the map doesn't
  pay for it. Bad LaTeX shows as plain text, never an error.
- **Old saved sets** (v1 shape) are dropped on open with "This study set was made with an older
  version. Make it again." and a button.

## Left to the builder

Prompt wording; topic/problem counts within ranges; rail layout on phones (collapses to a week
heading above the content).
