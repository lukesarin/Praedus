import { useEffect, useState } from 'react'
import { db } from '../db/db'
import { errorText } from './client'
import type { ClassKind } from './classType'
import { MathText } from './MathText'
import type { Problem, Step, Topic } from './shape'
import { isError, useStudySet, type StoredStudySet } from './store'
import { STREAK_TO_LEARN, type TopicState } from './weekSession'

type Props = {
  testId: string
  getToken: () => Promise<string | null>
  onClose: () => void
  onPlan: () => void
}

const LETTERS = ['A', 'B', 'C', 'D']

/** Keyboard shortcuts that stay out of the way of form fields. */
function useKeys(handler: (e: KeyboardEvent) => void, deps: unknown[]) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('select, input, textarea')) return
      handler(e)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

function Steps({ steps }: { steps: Step[] }) {
  return (
    <ol className="study-steps">
      {steps.map((s, i) => (
        <li key={i}>
          {s.label && <span className="study-step-label"><MathText text={s.label} />: </span>}
          <MathText text={s.work} />
        </li>
      ))}
    </ol>
  )
}

/** The full-screen study session: week by week, a lesson for each topic, then problems. */
export function StudySession({ testId, getToken, onClose, onPlan }: Props) {
  const study = useStudySet(testId, getToken)
  const set = study.set

  // Weeks left unmade last time (closed mid-way, or offline) get made now.
  useEffect(() => {
    study.resume()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  if (set === undefined) return <div className="study" role="dialog" aria-label="Study set" />
  if (set === null || set === 'old') {
    return (
      <div className="study" role="dialog" aria-label="Study set">
        <div className="study-body">
          <p className="study-note">
            {set === 'old' ? 'This study set was made with an older version. Make it again.' : "This study set isn't here anymore."}
          </p>
          <div className="study-actions center">
            {set === 'old' && (
              <button className="primary-btn" onClick={() => void db.studySets.delete(testId).then(onClose)}>Make it again</button>
            )}
            <button className="study-again" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    )
  }

  const { session } = set
  const cur = session.current
  const planWeek = cur ? set.weeks[cur.week] : undefined
  const made = planWeek ? set.generated[planWeek.weekId] : undefined
  const topic: Topic | undefined = cur && cur.topic >= 0 && made && !isError(made) ? made.topics[cur.topic] : undefined
  const state: TopicState | undefined = cur && cur.topic >= 0 ? session.weeks[cur.week]?.topics[cur.topic] : undefined
  const where = planWeek && topic ? `${planWeek.label}, ${topic.title}` : ''

  return (
    <div className="study" role="dialog" aria-label={`Study set for ${set.testTitle}`}>
      <header className="study-head">
        <div>
          <h2>Study set for {set.testTitle}</h2>
          <p>{set.className}</p>
        </div>
        <label className="study-kind">
          Cards:
          <select value={set.kind} onChange={(e) => void study.setKind(e.target.value as ClassKind)}>
            <option value="problems">Worked problems</option>
            <option value="ideas">Ideas</option>
          </select>
        </label>
        <button className="study-leave" onClick={onClose}>Leave</button>
      </header>

      <div className="study-layout">
        <Rail set={set} onJump={(w, t) => void study.act({ jump: [w, t] })} />
        <div className="study-body">
          {session.done ? (
            <EndScreen set={set} onPlan={onPlan} onRemake={() => void study.remake()} onRetry={() => void study.retry()} onClose={onClose} />
          ) : !cur || !planWeek ? null : cur.topic < 0 ? (
            <p className="study-note">Making cards for {planWeek.label}…</p>
          ) : !topic || !state ? null : state.phase === 'lesson' ? (
            <Lesson key={`${planWeek.weekId}-${cur.topic}-${state.again}`} where={where} topic={topic} again={state.again}
              onStart={() => void study.act('startProblems')} />
          ) : (
            <ProblemView key={`${planWeek.weekId}-${cur.topic}-${state.asked}`} where={where} problem={topic.problems[state.problemIndex]}
              number={state.asked + 1} streak={state.streak}
              onAnswer={(correct) => void study.act({ correct })} onSkip={() => void study.act('skip')} />
          )}
        </div>
      </div>
    </div>
  )
}

function Rail({ set, onJump }: { set: StoredStudySet; onJump: (week: number, topic: number) => void }) {
  const cur = set.session.current
  return (
    <nav className="study-rail" aria-label="Weeks">
      {set.weeks.map((w, wi) => {
        const ws = set.session.weeks[wi]
        const made = set.generated[w.weekId]
        const topics = made && !isError(made) ? made.topics : []
        const finished = ws?.status === 'ready' && ws.topics.every((t) => t.phase === 'learned' || t.phase === 'review')
        return (
          <div key={w.weekId} className={`study-week${cur?.week === wi ? ' cur' : ''}`}>
            <h3>{w.label}{finished && <em>Done</em>}</h3>
            {ws?.status === 'waiting' && <p className="study-topic making"><i />Making cards…</p>}
            {ws?.status === 'error' && <p className="study-topic failed"><i />Couldn't make cards</p>}
            {topics.map((t, ti) => {
              const phase = ws?.topics[ti]?.phase
              const on = cur?.week === wi && cur.topic === ti && !set.session.done
              const canJump = !on && (phase === 'lesson' || phase === 'problems')
              return (
                <button key={ti} className={`study-topic ${phase ?? ''}${on ? ' on' : ''}`} disabled={!canJump}
                  onClick={() => onJump(wi, ti)} aria-current={on ? 'step' : undefined}>
                  <i />{t.title}{phase === 'review' && <span> (review)</span>}
                </button>
              )
            })}
          </div>
        )
      })}
    </nav>
  )
}

function Lesson({ where, topic, again, onStart }: { where: string; topic: Topic; again: boolean; onStart: () => void }) {
  useKeys((e) => e.key === 'Enter' && onStart(), [onStart])
  const ex = topic.lesson.example
  return (
    <section className="study-lesson" aria-label={`Lesson: ${topic.title}`}>
      {again && <p className="study-banner">Two misses in a row, so here's the idea again before more problems.</p>}
      <p className="study-step">{where}: lesson</p>
      <h3>{topic.title}</h3>
      <p className="study-overview"><MathText text={topic.lesson.overview} /></p>
      <div className="study-example">
        <b>Worked example</b>
        <p><MathText text={ex.problem} /></p>
        <Steps steps={ex.steps} />
        <p className="study-answer">Answer: <MathText text={ex.answer} /></p>
      </div>
      <div className="study-actions">
        <button className="primary-btn" onClick={onStart}>Try problems</button>
      </div>
    </section>
  )
}

function ProblemView({ where, problem, number, streak, onAnswer, onSkip }: {
  where: string; problem: Problem; number: number; streak: number; onAnswer: (correct: boolean) => void; onSkip: () => void
}) {
  const [picked, setPicked] = useState<number | null>(null)
  const [stuck, setStuck] = useState(false)
  const right = picked === problem.correct
  const shown = picked === null ? (stuck ? 0 : streak) : right ? streak + 1 : 0
  const settled = picked !== null || stuck
  useKeys((e) => {
    const i = LETTERS.indexOf(e.key.toUpperCase())
    const n = ['1', '2', '3', '4'].indexOf(e.key)
    if (!settled && (i >= 0 || n >= 0)) setPicked(i >= 0 ? i : n)
    else if (e.key === 'Enter' && picked !== null) onAnswer(right)
    else if (e.key === 'Enter' && stuck) onSkip()
  }, [settled, picked, stuck, right, onAnswer, onSkip])

  return (
    <section className="study-check" aria-label={`${where}, problem ${number}`}>
      <div className="study-check-head">
        <p className="study-step">{where}: problem {number}</p>
        <span className="study-streak" aria-label={`${shown} of ${STREAK_TO_LEARN} in a row`}>
          {Array.from({ length: STREAK_TO_LEARN }, (_, i) => <i key={i} className={i < shown ? 'on' : ''} />)}
        </span>
      </div>
      <p className="study-prompt"><MathText text={problem.prompt} /></p>
      <ul className="study-choices">
        {problem.choices.map((c, i) => {
          const cls = !settled ? '' : i === problem.correct ? ' correct' : i === picked ? ' wrong' : ' dim'
          return (
            <li key={i}>
              <button className={`study-choice${cls}`} disabled={settled} onClick={() => setPicked(i)}>
                <b>{LETTERS[i]}</b><span><MathText text={c} /></span>
              </button>
            </li>
          )
        })}
      </ul>
      {stuck && (
        <div className="study-solution">
          <h4>How to solve it</h4>
          <Steps steps={problem.solution.steps} />
          <p className="study-answer">Answer: <MathText text={problem.solution.answer} /></p>
        </div>
      )}
      {picked !== null && (
        <div className={`study-feedback${right ? ' right' : ''}`} role="status">
          <p>{right ? (shown >= STREAK_TO_LEARN ? 'Right. 3 in a row: topic learned.' : 'Right.') : <MathText text={problem.whyWrong[picked] || 'Not quite.'} />}</p>
          <button className="primary-btn" onClick={() => onAnswer(right)} autoFocus>Next</button>
        </div>
      )}
      {picked === null && (
        <div className="study-qfoot">
          {stuck ? (
            <>
              <p>Counts as skipped: the streak starts over.</p>
              <button className="primary-btn" onClick={onSkip} autoFocus>Got it</button>
            </>
          ) : (
            <button className="study-stuck" onClick={() => setStuck(true)}>I'm stuck: show me how</button>
          )}
        </div>
      )}
    </section>
  )
}

function EndScreen({ set, onPlan, onRemake, onRetry, onClose }: {
  set: StoredStudySet; onPlan: () => void; onRemake: () => void; onRetry: () => void; onClose: () => void
}) {
  const all = set.session.weeks.flatMap((w, wi) => {
    const made = set.generated[set.weeks[wi]?.weekId]
    return w.topics.map((t, ti) => ({ phase: t.phase, title: made && !isError(made) ? made.topics[ti]?.title ?? '' : '' }))
  })
  const learned = all.filter((t) => t.phase === 'learned')
  const review = all.filter((t) => t.phase === 'review')
  const failedWeeks = set.weeks.filter((w) => isError(set.generated[w.weekId]))
  const firstError = failedWeeks.map((w) => set.generated[w.weekId]).find(isError)
  const nothing = all.length === 0
  return (
    <section className="study-end" aria-label="Done">
      <h3>{nothing ? 'No cards yet' : learned.length === 1 ? '1 topic learned' : `${learned.length} topics learned`}</h3>
      {review.length > 0 && (
        <>
          <p>Worth another look before {set.testTitle}:</p>
          <ul>{review.map((t, i) => <li key={i}>{t.title}</li>)}</ul>
        </>
      )}
      {failedWeeks.length > 0 && (
        <div className="study-failed">
          <p>
            {nothing ? '' : `${failedWeeks.map((w) => w.label).join(', ')} couldn't be made. `}
            {errorText(firstError?.error ?? 'failed')}
          </p>
          <button className="primary-btn" onClick={onRetry}>Try again</button>
        </div>
      )}
      <div className="study-actions center">
        {review.length > 0 && <button className="primary-btn" onClick={onPlan}>Plan review time</button>}
        {!nothing && <button className="study-again" onClick={onRemake}>Make it again</button>}
        <button className="study-again" onClick={onClose}>Done</button>
      </div>
    </section>
  )
}
