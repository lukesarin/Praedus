import { useEffect, useState } from 'react'
import { errorText } from './client'
import type { ClassKind } from './classType'
import { STREAK_TO_LEARN, type TopicState } from './session'
import { isError, useStudySet, type StoredStudySet } from './store'

type Props = {
  testId: string
  getToken: () => Promise<string | null>
  onClose: () => void
  onPlan: () => void
}

const LETTERS = ['A', 'B', 'C', 'D']

function stateLabel(t: TopicState): string {
  switch (t.phase) {
    case 'learned': return 'Learned'
    case 'review': return 'Needs review'
    case 'waiting': return 'Making cards'
    case 'error': return "Couldn't make cards"
    default: return 'Studying'
  }
}

/** The full-screen study session: flashcards for each topic, then a check until 3 in a row. */
export function StudySession({ testId, getToken, onClose, onPlan }: Props) {
  const study = useStudySet(testId, getToken)
  const set = study.set

  // Topics left unmade last time (closed mid-way, or offline) get made now.
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
  if (set === null) {
    return (
      <div className="study" role="dialog" aria-label="Study set">
        <div className="study-body"><p className="study-note">This study set isn't here anymore.</p>
          <button className="primary-btn" onClick={onClose}>Close</button></div>
      </div>
    )
  }

  const { session } = set
  const current = session.topics[session.current]
  const topic = set.topics.find((t) => t.id === current?.topicId)
  const made = topic ? set.generated[topic.id] : undefined

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

      <ol className="study-topics" aria-label="Topics">
        {session.topics.map((t, i) => {
          const title = set.topics.find((x) => x.id === t.topicId)?.title ?? ''
          return (
            <li key={t.topicId} className={`${t.phase}${i === session.current && !session.done ? ' on' : ''}`} title={`${title}: ${stateLabel(t)}`}>
              <span>{title}</span>
            </li>
          )
        })}
      </ol>

      <div className="study-body">
        {session.done ? (
          <EndScreen set={set} onPlan={onPlan} onRemake={() => void study.remake()} onRetry={(id) => void study.retry(id)} onClose={onClose} />
        ) : !current || !topic ? null : current.phase === 'waiting' ? (
          <p className="study-note">Making cards for {topic.title}…</p>
        ) : current.phase === 'error' ? (
          <div className="study-error">
            <p>{isError(made) ? errorText(made.error) : errorText('failed')}</p>
            <button className="primary-btn" onClick={() => void study.retry(topic.id)}>Try again</button>
          </div>
        ) : made && !isError(made) && current.phase === 'cards' ? (
          <CardView key={`${topic.id}-${current.cardQueue.join('.')}`} topicTitle={topic.title} card={made.cards[current.cardQueue[0]]}
            left={current.cardQueue.length} onGotIt={() => void study.act('gotIt')} onAgain={() => void study.act('again')} />
        ) : made && !isError(made) && current.phase === 'check' ? (
          <CheckView key={`${topic.id}-${current.asked}`} topicTitle={topic.title} question={made.questions[current.questionIndex]}
            number={current.asked + 1} streak={current.streak} onDone={(correct) => void study.act({ correct })} />
        ) : null}
      </div>
    </div>
  )
}

function CardView({ topicTitle, card, left, onGotIt, onAgain }: {
  topicTitle: string; card: { front: string; back: string }; left: number; onGotIt: () => void; onAgain: () => void
}) {
  const [flipped, setFlipped] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('select, input, textarea')) return
      if (e.key === ' ') { e.preventDefault(); setFlipped((f) => !f) }
      if (flipped && e.key === '1') onGotIt()
      if (flipped && e.key === '2') onAgain()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [flipped, onGotIt, onAgain])

  return (
    <section className="study-card-wrap" aria-label={`${topicTitle}, flashcards`}>
      <p className="study-step">{topicTitle}: {left === 1 ? '1 card left' : `${left} cards left`}</p>
      <button className={`study-card${flipped ? ' flipped' : ''}`} onClick={() => setFlipped((f) => !f)} aria-label={flipped ? 'Answer. Click to see the question' : 'Question. Click to see the answer'}>
        <span className="study-card-side">{flipped ? 'Answer' : 'Question'}</span>
        <span className="study-card-text">{flipped ? card.back : card.front}</span>
        {!flipped && <span className="study-card-hint">Click or press Space to see the answer</span>}
      </button>
      {flipped && (
        <div className="study-actions">
          <button className="study-again" onClick={onAgain}>Again <kbd>2</kbd></button>
          <button className="primary-btn" onClick={onGotIt}>Got it <kbd>1</kbd></button>
        </div>
      )}
    </section>
  )
}

function CheckView({ topicTitle, question, number, streak, onDone }: {
  topicTitle: string
  question: { prompt: string; choices: string[]; correct: number; whyWrong: string[] }
  number: number
  streak: number
  onDone: (correct: boolean) => void
}) {
  const [picked, setPicked] = useState<number | null>(null)
  const right = picked === question.correct
  const shown = picked === null ? streak : right ? streak + 1 : 0
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('select, input, textarea')) return
      const i = LETTERS.indexOf(e.key.toUpperCase())
      const n = ['1', '2', '3', '4'].indexOf(e.key)
      if (picked === null && (i >= 0 || n >= 0)) setPicked(i >= 0 ? i : n)
      else if (picked !== null && e.key === 'Enter') onDone(right)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [picked, right, onDone])

  return (
    <section className="study-check" aria-label={`${topicTitle}, check`}>
      <div className="study-check-head">
        <p className="study-step">{topicTitle}: question {number}</p>
        <span className="study-streak" aria-label={`${shown} of ${STREAK_TO_LEARN} in a row`}>
          {Array.from({ length: STREAK_TO_LEARN }, (_, i) => <i key={i} className={i < shown ? 'on' : ''} />)}
        </span>
      </div>
      <p className="study-prompt">{question.prompt}</p>
      <ul className="study-choices">
        {question.choices.map((c, i) => {
          const state = picked === null ? '' : i === question.correct ? ' correct' : i === picked ? ' wrong' : ' dim'
          return (
            <li key={i}>
              <button className={`study-choice${state}`} disabled={picked !== null} onClick={() => setPicked(i)}>
                <b>{LETTERS[i]}</b><span>{c}</span>
              </button>
            </li>
          )
        })}
      </ul>
      {picked !== null && (
        <div className={`study-feedback${right ? ' right' : ''}`} role="status">
          <p>{right ? (shown >= STREAK_TO_LEARN ? 'Right. That’s 3 in a row: topic learned.' : 'Right.') : question.whyWrong[picked] || 'Not quite.'}</p>
          <button className="primary-btn" onClick={() => onDone(right)} autoFocus>Next</button>
        </div>
      )}
    </section>
  )
}

function EndScreen({ set, onPlan, onRemake, onRetry, onClose }: {
  set: StoredStudySet; onPlan: () => void; onRemake: () => void; onRetry: (topicId: string) => void; onClose: () => void
}) {
  const title = (id: string) => set.topics.find((t) => t.id === id)?.title ?? ''
  const learned = set.session.topics.filter((t) => t.phase === 'learned')
  const review = set.session.topics.filter((t) => t.phase === 'review')
  const failed = set.session.topics.filter((t) => t.phase === 'error')
  const firstError = failed.map((t) => set.generated[t.topicId]).find(isError)
  const nothing = learned.length === 0 && review.length === 0
  return (
    <section className="study-end" aria-label="Done">
      <h3>{nothing ? 'No cards yet' : learned.length === 1 ? '1 topic learned' : `${learned.length} topics learned`}</h3>
      {review.length > 0 && (
        <>
          <p>Worth another look before {set.testTitle}:</p>
          <ul>{review.map((t) => <li key={t.topicId}>{title(t.topicId)}</li>)}</ul>
        </>
      )}
      {failed.length > 0 && (
        <div className="study-failed">
          <p>
            {nothing ? '' : `${failed.length === 1 ? '1 topic' : `${failed.length} topics`} couldn't be made. `}
            {errorText(firstError?.error ?? 'failed')}
          </p>
          <button className="primary-btn" onClick={() => onRetry(failed[0].topicId)}>Try again</button>
        </div>
      )}
      <div className="study-actions">
        {review.length > 0 && <button className="primary-btn" onClick={onPlan}>Plan review time</button>}
        {!nothing && <button className="study-again" onClick={onRemake}>Make it again</button>}
        <button className="study-again" onClick={onClose}>Done</button>
      </div>
    </section>
  )
}
