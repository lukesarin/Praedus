import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import type { Course } from '../db/db'
import { dueInstant } from '../study/plan'
import { cardSpot, courseCode, type Donut, type DonutWeek, type WeekItem } from './donut'
import { plainDescription, weekHeading } from './panelText'

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

/** "Oct 26 to Nov 1" from a week's Monday. */
function weekSpan(start: string): string {
  const fmt = (key: string, add: number) => {
    const [y, m, d] = key.split('-').map(Number)
    return new Date(Date.UTC(y, m - 1, d + add)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  }
  return `${fmt(start, 0)} to ${fmt(start, 6)}`
}

function itemNote(x: WeekItem): string {
  if (x.test) return 'Test'
  if (x.reviewed) return 'Reviewed'
  if (x.status === 'late') return 'Not turned in'
  if (x.status === 'done') return 'Done'
  return ''
}

export function StudyMap({ courses, courseId, donut, onPickCourse, onPickTest, onOpenItem, hasTermStart, onSetTermStart }: Props) {
  const course = courses.find((c) => c.id === courseId)
  const pickedId = donut?.tests.find((t) => t.picked)?.item.id
  const line = donut ? weekLine(donut.weeks) : ''

  // The open week card. Keyed by class and test too, so changing either closes it.
  const [openKey, setOpenKey] = useState<string>()
  const keyFor = (start: string) => `${courseId}|${pickedId ?? ''}|${start}`
  const openWeek = donut?.weeks.find((w) => keyFor(w.week.start) === openKey)
  const toggleWeek = (start: string) => setOpenKey((k) => (k === keyFor(start) ? undefined : keyFor(start)))
  const close = () => setOpenKey(undefined)

  const canvasRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const cardRef = useRef<HTMLElement>(null)
  const leadRef = useRef<SVGSVGElement>(null)
  const [size, setSize] = useState(0)

  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize((n) => n + 1))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!openWeek) return
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && setOpenKey(undefined)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [openWeek])

  // Place the card in the nearest free corner and draw the line from the week to it.
  useLayoutEffect(() => {
    const svg = svgRef.current, canvas = canvasRef.current, card = cardRef.current, lead = leadRef.current
    const ctm = svg?.getScreenCTM()
    if (!openWeek || !svg || !canvas || !card || !lead || !ctm) return
    const box = canvas.getBoundingClientRect()
    const am = (openWeek.a0 + openWeek.a1) / 2
    const at = (r: number) => {
      const [x, y] = pt(am, r)
      const p = new DOMPoint(x, y).matrixTransform(ctm)
      return { x: p.x - box.left, y: p.y - box.top }
    }
    const edge = at(R1 + 3)
    const spot = cardSpot(edge, [at((R0 + R1) / 2), at(R0 + 12)], { w: card.offsetWidth, h: card.offsetHeight }, { w: box.width, h: box.height })
    card.style.left = `${spot.left}px`
    card.style.top = `${spot.top}px`
    const ex = Math.max(spot.left, Math.min(spot.left + card.offsetWidth, edge.x))
    const ey = Math.max(spot.top, Math.min(spot.top + card.offsetHeight, edge.y))
    lead.innerHTML = `<line x1="${edge.x}" y1="${edge.y}" x2="${ex}" y2="${ey}"/><circle cx="${edge.x}" cy="${edge.y}" r="3"/>`
  }, [openWeek, size])

  // A click on the chart that isn't on a week or a test closes the card.
  const onChartClick = (e: MouseEvent) => {
    if (!(e.target as Element).closest('.map-slice, .map-dot, .map-flag')) close()
  }

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

      <div className="map-canvas" ref={canvasRef}>
        {!donut || !course ? (
          <div className="map-empty muted">Your classes show up here once Canvas is connected.</div>
        ) : (
          <svg ref={svgRef} viewBox="-350 -312 700 624" role="group" aria-label={`Semester of ${course.name}`} onClick={onChartClick}>
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
                    role="button"
                    tabIndex={0}
                    aria-label={`${weekHeading(w.week)}: ${w.items.length === 1 ? '1 item' : `${w.items.length} items`}`}
                    aria-expanded={openWeek === w}
                    onClick={() => toggleWeek(w.week.start)}
                    onKeyDown={activate(() => toggleWeek(w.week.start))}
                  />
                  <text className={`map-wnum${w.inUnit ? ' in' : ''}${w.now ? ' now' : ''}`} x={nx} y={ny}
                    textAnchor="middle" dominantBaseline="central">{w.label}</text>
                  {w.dots.map((d, j) => {
                    const [x, y] = pt(am, R0 + 26 + j * step)
                    const cls = `map-dot${d.status ? ` ${d.status}` : ''}${d.reviewed ? ' rev' : ''}`
                    return (
                      <circle key={d.item.id} className={cls} cx={x} cy={y} r={DOT_R} aria-hidden="true"
                        style={{ fill: d.reviewed ? undefined : w.inUnit ? 'var(--bg)' : muted(course.color) }}
                        onClick={() => toggleWeek(w.week.start)} />
                    )
                  })}
                  {w.more > 0 && (
                    <text className={`map-more${w.inUnit ? ' in' : ''}`} x={mx} y={my} textAnchor="middle" dominantBaseline="central">
                      +{w.more}
                    </text>
                  )}
                </g>
              )
            })}

            {donut.weeks.filter((w) => w.now).map((w) => (
              <path key="now" className="map-now" d={slicePath(w.a0, w.a1, R0, R1)} />
            ))}
            {openWeek && <path className="map-sel" d={slicePath(openWeek.a0, openWeek.a1, R0, R1)} />}

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
        {openWeek && course && (
          <>
            <svg ref={leadRef} className="map-lead" aria-hidden="true" />
            <section key={openKey} ref={cardRef} className="map-card" aria-label={weekHeading(openWeek.week)}>
              <header className="map-card-head">
                <div>
                  <h3>{weekHeading(openWeek.week)}</h3>
                  <p>{weekSpan(openWeek.week.start)}</p>
                </div>
                <div className="map-card-tags">
                  {openWeek.now && <span className="map-tag now">This week</span>}
                  {openWeek.inUnit && donut?.unit && (
                    <span className="map-tag" style={{ background: `color-mix(in srgb, ${course.color} 24%, transparent)` }}>
                      On {donut.unit.test.title}
                    </span>
                  )}
                </div>
                <button className="map-card-x" aria-label="Close week" onClick={close}>×</button>
              </header>
              {openWeek.items.length === 0 ? (
                <p className="map-card-empty">Nothing was due this week.</p>
              ) : (
                <ul>
                  {openWeek.items.map((x) => {
                    const kind = x.test ? 'test' : x.reviewed ? 'rev' : x.status ?? 'todo'
                    const note = itemNote(x)
                    const desc = plainDescription(x.item.description, 90)
                    return (
                      <li key={x.item.id} className={`map-card-row ${kind}`}>
                        <i style={{ background: kind === 'todo' || kind === 'done' ? muted(course.color) : undefined }} />
                        <button onClick={() => onOpenItem(x.item.id)}>
                          <b>{x.item.title}</b>
                          {desc && <span>{desc}</span>}
                        </button>
                        <span className="map-card-when">
                          {new Date(dueInstant(x.item)).toLocaleDateString(undefined, { weekday: 'short' })}
                          {note && <em>{note}</em>}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}
