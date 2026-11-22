import type { KeyboardEvent } from 'react'
import type { Course } from '../db/db'
import { courseCode, type Donut, type DonutWeek } from './donut'
import { weekHeading } from './panelText'

type Props = {
  /** Classes that have something to map, sorted by name. */
  courses: Course[]
  courseId?: string
  donut: Donut | null
  onPickCourse: (courseId: string) => void
  /** `undefined` unpicks the test. */
  onPickTest: (testId: string | undefined) => void
  onOpenItem: (itemId: string) => void
  hasTermStart: boolean
  onSetTermStart: () => void
  now: Date
}

/** Inner and outer radius of the ring, in viewBox units. */
const R0 = 118
const R1 = 262
const DOT_R = 5.5
/** Calmer than the calendar: course colors blended a little toward gray. */
const muted = (color: string, pct = 78) => `color-mix(in srgb, ${color} ${pct}%, #8a8a8a)`
/** 0 = twelve o'clock, clockwise. */
const pt = (a: number, r: number): [number, number] => [Math.sin(a) * r, -Math.cos(a) * r]
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s)

function slicePath(a0: number, a1: number, r0: number, r1: number): string {
  const big = a1 - a0 > Math.PI ? 1 : 0
  const [x0, y0] = pt(a0, r1)
  const [x1, y1] = pt(a1, r1)
  const [x2, y2] = pt(a1, r0)
  const [x3, y3] = pt(a0, r0)
  return `M${x0},${y0} A${r1},${r1} 0 ${big} 1 ${x1},${y1} L${x2},${y2} A${r0},${r0} 0 ${big} 0 ${x3},${y3}Z`
}

/** Enter or space acts like a click, for the chart's focusable marks. */
const activate = (fn: () => void) => (e: KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    fn()
  }
}

function weekLine(weeks: DonutWeek[]): string {
  const current = weeks.find((w) => w.now)
  if (!current) return weeks.length === 1 ? '1 week' : `${weeks.length} weeks`
  return current.week.number !== undefined ? `Week ${current.week.number} of ${weeks.length}` : weekHeading(current.week)
}

export function StudyMap({ courses, courseId, donut, onPickCourse, onPickTest, onOpenItem, hasTermStart, onSetTermStart }: Props) {
  const course = courses.find((c) => c.id === courseId)
  const pickedId = donut?.tests.find((t) => t.picked)?.item.id
  const line = donut ? weekLine(donut.weeks) : ''

  return (
    <div className="map-page">
      <div className="map-bar">
        {courses.length > 0 && (
          <label className="map-class">
            <i style={{ background: course?.color }} />
            <select aria-label="Class" value={courseId ?? ''} onChange={(e) => onPickCourse(e.target.value)}>
              {courses.map((c) => {
                const code = courseCode(c.name)
                return <option key={c.id} value={c.id}>{code === c.name ? c.name : `${code} · ${c.name.replace(/^[A-Za-z]{2,6}[\s-]*\d{2,4}[A-Za-z]?\b[\s:·-]*/, '') || c.name}`}</option>
              })}
            </select>
          </label>
        )}
        {donut && <span className="map-meta">{line}</span>}
        {!hasTermStart && donut && (
          <button className="map-link-btn" onClick={onSetTermStart}>Set first day of classes</button>
        )}
        {donut && course && (
          <div className="map-legend" aria-hidden="true">
            <span><i style={{ background: muted(course.color, 62) }} />Covered weeks</span>
            <span><i className="dot" style={{ background: muted(course.color) }} />Assignment</span>
            <span><i className="dot" style={{ background: 'var(--accent)' }} />Reviewed</span>
          </div>
        )}
      </div>

      <div className="map-canvas">
        {!donut || !course ? (
          <div className="map-empty muted">Your classes show up here once Canvas is connected.</div>
        ) : (
          <svg viewBox="-350 -312 700 624" role="group" aria-label={`Semester of ${course.name}`}>
            {donut.weeks.map((w) => {
              const am = (w.a0 + w.a1) / 2
              const [nx, ny] = pt(am, R1 - 16)
              const step = w.more > 0 ? 16 : 21
              const [mx, my] = pt(am, R0 + 26 + w.dots.length * step)
              const odd = (w.week.number ?? donut.weeks.indexOf(w) + 1) % 2 === 0
              return (
                <g key={w.week.start}>
                  <path
                    key={w.inUnit ? `in-${pickedId}` : 'out'}
                    className={`map-slice${odd ? ' alt' : ''}${w.inUnit ? ' in fadein' : ''}`}
                    d={slicePath(w.a0, w.a1, R0, R1)}
                    style={w.inUnit ? { fill: muted(course.color, 62) } : undefined}
                  >
                    <title>{weekHeading(w.week)}{w.now ? ' (this week)' : ''}</title>
                  </path>
                  <text className={`map-wnum${w.inUnit ? ' in' : ''}${w.now ? ' now' : ''}`} x={nx} y={ny}
                    textAnchor="middle" dominantBaseline="central">{w.label}</text>
                  {w.dots.map((d, j) => {
                    const [x, y] = pt(am, R0 + 26 + j * step)
                    const cls = `map-dot${d.status ? ` ${d.status}` : ''}${d.reviewed ? ' rev' : ''}`
                    return (
                      <circle key={d.item.id} className={cls} cx={x} cy={y} r={DOT_R} role="button" tabIndex={0}
                        aria-label={d.item.title}
                        style={{ fill: d.reviewed ? undefined : w.inUnit ? 'var(--bg)' : muted(course.color) }}
                        onClick={() => onOpenItem(d.item.id)} onKeyDown={activate(() => onOpenItem(d.item.id))}>
                        <title>{d.item.title}{d.status === 'late' ? ' (not turned in)' : d.status === 'done' ? ' (done)' : ''}</title>
                      </circle>
                    )
                  })}
                  {w.more > 0 && (
                    <text className={`map-more${w.inUnit ? ' in' : ''}`} x={mx} y={my} textAnchor="middle" dominantBaseline="central">
                      +{w.more}
                      <title>{w.more} more in {weekHeading(w.week)}</title>
                    </text>
                  )}
                </g>
              )
            })}

            {donut.weeks.filter((w) => w.now).map((w) => (
              <path key="now" className="map-now" d={slicePath(w.a0, w.a1, R0, R1)} />
            ))}

            {donut.tests.map((t) => {
              const out = R1 + 18 + t.lane * 16
              const [x0, y0] = pt(t.angle, R1 + 4)
              const [x1, y1] = pt(t.angle, R1 + 14 + t.lane * 16)
              const [tx, ty] = pt(t.angle, out)
              const sx = Math.sin(t.angle)
              const cy = -Math.cos(t.angle)
              const anchor = sx < -0.15 ? 'end' : sx > 0.15 ? 'start' : 'middle'
              const dy = cy > 0.6 ? 10 : cy < -0.6 ? -4 : 4
              const label = clip(t.item.title, 18)
              const w = label.length * 6.6 + 12
              const rx = anchor === 'end' ? tx - w : anchor === 'start' ? tx : tx - w / 2
              const pick = () => onPickTest(t.picked ? undefined : t.item.id)
              return (
                <g key={t.item.id} className={`map-flag${t.picked ? ' on' : ''}${t.past ? ' past' : ''}`} role="button"
                  tabIndex={0} aria-pressed={t.picked} aria-label={t.item.title} onClick={pick} onKeyDown={activate(pick)}>
                  <line x1={x0} y1={y0} x2={x1} y2={y1} />
                  <rect x={rx - 4} y={ty + dy - 15} width={w + 8} height={22} />
                  <text x={tx} y={ty + dy} textAnchor={anchor}>{label}</text>
                  <title>{t.item.title}</title>
                </g>
              )
            })}

            <circle r={R0 - 6} className="map-hole" />
            <text className="map-center-code" textAnchor="middle" y={-6}>{courseCode(course.name)}</text>
            <text className="map-center-name" textAnchor="middle" y={14}>{clip(course.name, 30)}</text>
            <text className="map-center-wk" textAnchor="middle" y={34}>{line}</text>
          </svg>
        )}
      </div>
    </div>
  )
}
