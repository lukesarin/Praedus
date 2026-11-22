import type { DateSelectArg, DatesSetArg, DayHeaderContentArg, EventChangeArg, EventClickArg, EventContentArg } from '@fullcalendar/core'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import listPlugin from '@fullcalendar/list'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import { useEffect, useMemo, useRef, useState } from 'react'
import { expandCommitments } from '../commitments/expand'
import type { Commitment } from '../commitments/types'
import type { CalendarItem, Course } from '../db/db'
import type { StudyBlock } from '../study/types'
import { PinIcon } from '../app/icons'
import { addDays, localDateKey } from './dates'
import { dayHeaderParts } from './dayHeader'
import { commitmentEvents, studyBlockEvents, toCalendarEvents, type EventProps, type Marks } from './toEvents'

/** Week view: weekday over a date number (today's number is circled by CSS). Other views keep their text. */
function renderDayHeader(arg: DayHeaderContentArg) {
  if (arg.view.type !== 'timeGridWeek') return arg.text
  const { weekday, day } = dayHeaderParts(arg.date)
  return (
    <span className="sb-dayhead">
      <span className="sb-dow">{weekday}</span>
      <span className="sb-dnum">{day}</span>
    </span>
  )
}

export type CommitmentChange = {
  occurrenceId: string
  commitmentId: string
  start: Date
  end: Date
  /** Puts the block back where it was. */
  revert: () => void
}

export type StudyBlockChange = { blockId: string; start: Date; end: Date; revert: () => void }

type Props = {
  items: CalendarItem[]
  courses: Course[]
  commitments: Commitment[]
  studyBlocks: StudyBlock[]
  marks: Marks
  /** Jump here when it changes (`nonce` lets the same date be requested twice). */
  focus?: { date: string; nonce: number }
  onSelectItem: (itemId: string) => void
  onSelectCommitment: (commitmentId: string, occurrenceId: string) => void
  onCreateRange: (start: Date, end: Date) => void
  onChangeCommitment: (change: CommitmentChange) => void
  onSelectStudyBlock: (blockId: string) => void
  onChangeStudyBlock: (change: StudyBlockChange) => void
}

const isNarrow = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches

function renderEvent(arg: EventContentArg) {
  const props = arg.event.extendedProps as EventProps
  if (props.kind === 'assignment') {
    const label = props.dueTime ? `${arg.event.title} · due ${props.dueTime}` : arg.event.title
    return (
      <div className="sb-deadline" title={label}>
        <span className="dot" style={{ background: arg.event.backgroundColor }} />
        <span className="sb-title">{arg.event.title}</span>
        {props.dueTime && <span className="sb-time">{props.dueTime}</span>}
      </div>
    )
  }
  if (props.kind === 'study') {
    return (
      <div className="sb-study-content" title={`${arg.event.title} · ${arg.timeText}`}>
        <div className="sb-study-title">
          {arg.event.title}
          {arg.event.classNames.includes('is-pinned') && <span className="pin" title="Pinned"><PinIcon /></span>}
        </div>
        <div className="sb-study-time">{arg.timeText}</div>
      </div>
    )
  }
  return true // FullCalendar renders timed events itself
}

export function CalendarView(props: Props) {
  const { items, courses, commitments, studyBlocks, marks, focus } = props
  const ref = useRef<FullCalendar>(null)
  const narrow = isNarrow()
  const [range, setRange] = useState(() => {
    const today = localDateKey(new Date())
    return { from: addDays(today, -7), to: addDays(today, 42) }
  })

  const events = useMemo(() => {
    const occs = expandCommitments(commitments, range.from, range.to)
    return [
      ...toCalendarEvents(items, courses, marks),
      ...commitmentEvents(occs, courses, marks),
      ...studyBlockEvents(studyBlocks, items, courses),
    ]
  }, [items, courses, commitments, studyBlocks, marks, range])

  useEffect(() => {
    if (!focus) return
    const api = ref.current?.getApi()
    if (!api) return
    if (!narrow && api.view.type !== 'timeGridWeek') api.changeView('timeGridWeek')
    api.gotoDate(focus.date)
    // Scroll near the time if one was given.
    if (focus.date.includes('T')) {
      const d = new Date(focus.date)
      api.scrollToTime({ hours: Math.max(0, d.getHours() - 1) })
    }
  }, [focus, narrow])

  function onDatesSet(arg: DatesSetArg) {
    const from = localDateKey(arg.start)
    const to = addDays(localDateKey(arg.end), -1)
    setRange((r) => (r.from === from && r.to === to ? r : { from, to }))
  }

  function onClick(info: EventClickArg) {
    const p = info.event.extendedProps as EventProps
    if (p.kind === 'commitment') props.onSelectCommitment(p.commitmentId, p.occurrenceId)
    else if (p.kind === 'study') props.onSelectStudyBlock(p.blockId)
    else props.onSelectItem(p.itemId)
  }

  function onChange(info: EventChangeArg) {
    const p = info.event.extendedProps as EventProps
    const { start, end } = info.event
    if (!start || !end) return info.revert()
    if (p.kind === 'study') return props.onChangeStudyBlock({ blockId: p.blockId, start, end, revert: info.revert })
    if (p.kind !== 'commitment') return info.revert()
    props.onChangeCommitment({ occurrenceId: p.occurrenceId, commitmentId: p.commitmentId, start, end, revert: info.revert })
  }

  function onSelect(info: DateSelectArg) {
    info.view.calendar.unselect()
    if (info.allDay) return
    props.onCreateRange(info.start, info.end)
  }

  return (
    <div className="calendar-wrap">
      <FullCalendar
        ref={ref}
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
        initialView={narrow ? 'listWeek' : 'timeGridWeek'}
        headerToolbar={
          narrow
            ? { left: 'prev,next', center: 'title', right: 'dayGridMonth,listWeek' }
            : { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,listWeek' }
        }
        buttonText={{ today: 'Today', month: 'Month', week: 'Week', list: 'Agenda' }}
        allDayText="Due"
        dayHeaderContent={renderDayHeader}
        height="100%"
        nowIndicator
        dayMaxEvents={4}
        scrollTime="08:00:00"
        firstDay={1}
        events={events}
        eventContent={renderEvent}
        eventClick={onClick}
        // Only commitments are editable (set per event); they stay out of the "Due" row.
        eventAllow={(drop) => !drop.allDay}
        eventChange={onChange}
        snapDuration="00:15:00"
        selectable={!narrow}
        selectMirror
        select={onSelect}
        datesSet={onDatesSet}
        noEventsText="Nothing scheduled."
      />
    </div>
  )
}
