import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force'
import { polygonHull } from 'd3-polygon'
import { select } from 'd3-selection'
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Course } from '../db/db'
import { dueInstant } from '../study/plan'
import { courseCode, type buildClassGraph, type MapNode } from './graph'
import { LABEL_GAP, placeLabels, type Box } from './labels'
import { weekHeading } from './panelText'

type Graph = ReturnType<typeof buildClassGraph>
type SimNode = SimulationNodeDatum & { id: string; kind: MapNode['kind']; week?: string }
type SimLink = SimulationLinkDatum<SimNode> & { source: SimNode | string; target: SimNode | string; kind: string }

type Props = {
  /** Classes that have items, sorted by name. */
  courses: Course[]
  courseId?: string
  graph: Graph | null
  now: Date
  onPickCourse: (courseId: string) => void
  onPickTest: (testId: string) => void
  onOpenItem: (itemId: string) => void
  hasTermStart: boolean
  onSetTermStart: () => void
}

const DOT_RADIUS = 4.5
/** Invisible click target, so small dots stay easy to hit. */
const HIT_RADIUS = 10
const WEEK_RADIUS = 12
const PILL_HEIGHT = 28
const TAG_HEIGHT = 20
const SPINE = 54
/** The unit's region: a hull with a wide round stroke, so it pads its outer nodes evenly. */
const HULL_PAD = 56
/** Below this zoom labels get too small to read, so the automatic fit frames the picked unit instead. */
const MIN_READABLE_ZOOM = 0.8

const pillWidth = (code: string) => code.length * 7.6 + 28
const tagText = (s: string) => (s.length > 22 ? `${s.slice(0, 21)}…` : s)
const tagWidth = (s: string) => tagText(s).length * 6.3 + 16
const weekPillWidth = (label: string) => label.length * 5.8 + 14
const labelText = (s: string) => (s.length > 30 ? `${s.slice(0, 29)}…` : s)

/** Calmer than the calendar: course colors blended a little toward gray. */
const muted = (color: string) => `color-mix(in srgb, ${color} 78%, #8a8a8a)`

const shortDate = (ms: number) => new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
const longDate = (ms: number) =>
  new Date(ms).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })

/** Small stable pseudo-random number in [-0.5, 0.5) from an id, so layouts start the same way every time. */
function jitter(id: string, salt: number): number {
  let h = 2166136261 ^ salt
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return (h >>> 0) / 4294967296 - 0.5
}

/** How far the weeks sit from the class: about the length of the trail, bent into a circle. */
const weekRadius = (weeks: number) => Math.min(200, Math.max(90, (weeks * SPINE) / (2 * Math.PI)))

const endId = (end: SimNode | string) => (typeof end === 'string' ? end : end.id)

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Starting spots: weeks in order around a circle (like a clock), each week's items just outside it. */
function seed(graph: Graph, radius: number): Map<string, { x: number; y: number }> {
  const out = new Map<string, { x: number; y: number }>()
  const n = Math.max(1, graph.weeks.length)
  const angle = new Map(graph.weeks.map((w, i) => [w.start, -Math.PI / 2 + ((i + 0.5) / n) * 2 * Math.PI]))
  for (const node of graph.nodes) {
    if (node.kind === 'course') out.set(node.id, { x: 0, y: 0 })
    else if (node.kind === 'week') {
      const a = angle.get(node.refId) ?? 0
      out.set(node.id, { x: Math.cos(a) * radius, y: Math.sin(a) * radius })
    } else {
      const a = (angle.get(node.week ?? '') ?? 0) + jitter(node.id, 1) * 0.5
      const r = radius + 60 + jitter(node.id, 2) * 20
      out.set(node.id, { x: Math.cos(a) * r, y: Math.sin(a) * r })
    }
  }
  return out
}

export function StudyMap({
  courses,
  courseId,
  graph,
  now,
  onPickCourse,
  onPickTest,
  onOpenItem,
  hasTermStart,
  onSetTermStart,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const simRef = useRef<Simulation<SimNode, SimLink> | null>(null)
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const positions = useRef(new Map<string, { x: number; y: number }>())
  const positionsFor = useRef<string | undefined>(undefined)
  /** The student panned, zoomed or dragged since the layout last changed, so don't re-fit under them. */
  const touched = useRef(false)
  const drag = useRef<{ node: SimNode; startX: number; startY: number; moved: boolean } | null>(null)
  /** The picked unit's nodes and its test: what the automatic fit frames when the whole class won't fit readably. */
  const focusIds = useRef(new Set<string>())

  const [size, setSize] = useState({ w: 800, h: 600 })
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity)
  const [, setFrame] = useState(0)
  const [hovered, setHovered] = useState<string | null>(null)
  const [simNodes, setSimNodes] = useState<SimNode[]>([])
  const [simLinks, setSimLinks] = useState<SimLink[]>([])

  const course = courses.find((c) => c.id === courseId)
  useEffect(() => {
    focusIds.current = new Set((graph?.nodes ?? []).filter((n) => n.kind !== 'course' && (n.inUnit || n.picked)).map((n) => n.id))
  }, [graph])
  const nodeById = useMemo(() => new Map((graph?.nodes ?? []).map((n) => [n.id, n])), [graph])
  const itemById = useMemo(() => new Map((graph?.tests ?? []).map((t) => [t.id, t])), [graph])
  // The simulation restarts only when the shape of the graph changes, not when a tick box does.
  const structure = graph
    ? `${courseId}|${graph.nodes.map((n) => n.id).join(',')}|${graph.links.map((l) => `${l.source}>${l.target}`).join(',')}`
    : ''

  // Track the container size.
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setSize({ w: entry.contentRect.width, h: entry.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Re-center when the map area changes size (window resize, phone rotation).
  useEffect(() => {
    const t = setTimeout(() => fit(), 150)
    return () => clearTimeout(t)
  }, [size.w, size.h]) // eslint-disable-line react-hooks/exhaustive-deps

  // Pan and zoom (drags that start on a node are left to the node).
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const z = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .filter((e: Event) => e.type === 'wheel' || !(e.target as Element).closest?.('.map-node'))
      .on('zoom', (e: { transform: ZoomTransform; sourceEvent: Event | null }) => {
        if (e.sourceEvent) touched.current = true
        setTransform(e.transform)
      })
    zoomRef.current = z
    select(svg).call(z).on('dblclick.zoom', null)
    return () => {
      select(svg).on('.zoom', null)
    }
  }, [])

  // (Re)start the simulation when the graph's shape changes, keeping nodes where they were.
  useEffect(() => {
    // Without a graph nothing renders, since every node is looked up in it.
    if (!graph) return
    if (positionsFor.current !== courseId) {
      positions.current.clear()
      positionsFor.current = courseId
    }
    const radius = weekRadius(graph.weeks.length)
    const seeds = seed(graph, radius)
    const sn: SimNode[] = graph.nodes.map((n) => {
      const p = positions.current.get(n.id) ?? seeds.get(n.id)!
      // The class stays put in the middle.
      return n.kind === 'course'
        ? { id: n.id, kind: n.kind, x: 0, y: 0, fx: 0, fy: 0 }
        : { id: n.id, kind: n.kind, week: n.week, x: p.x, y: p.y }
    })
    const sl: SimLink[] = graph.links.map((l) => ({ ...l }))
    const kindOf = new Map(graph.nodes.map((n) => [n.id, n.kind]))
    const labelOf = new Map(graph.nodes.map((n) => [n.id, n.label]))
    const sim = forceSimulation<SimNode, SimLink>(sn)
      .force(
        'link',
        forceLink<SimNode, SimLink>(sl)
          .id((d) => d.id)
          .distance((l) =>
            l.kind === 'spoke' ? radius : l.kind === 'spine' ? SPINE : kindOf.get(endId(l.target)) === 'test' ? 52 : 44)
          .strength((l) => (l.kind === 'spoke' ? 0.22 : l.kind === 'spine' ? 0.6 : 0.8)),
      )
      .force('charge', forceManyBody<SimNode>().strength((d) => (d.kind === 'course' ? -500 : d.kind === 'week' ? -140 : -70)))
      .force(
        'collide',
        forceCollide<SimNode>().radius((d) => {
          const label = labelOf.get(d.id) ?? ''
          if (d.kind === 'course') return pillWidth(label) / 2 + 12
          if (d.kind === 'week') return /\d$/.test(label) && label.length <= 2 ? 17 : weekPillWidth(label) / 2 + 5
          if (d.kind === 'test') return Math.min(tagWidth(label) / 2, 40) + 6
          return 11
        }),
      )
    let raf = 0
    sim.on('tick', () => {
      for (const n of sn) positions.current.set(n.id, { x: n.x ?? 0, y: n.y ?? 0 })
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; setFrame((f) => f + 1) })
    })
    if (prefersReducedMotion()) {
      // Settle before showing, instead of animating into place.
      sim.stop()
      sim.tick(300)
      for (const n of sn) positions.current.set(n.id, { x: n.x ?? 0, y: n.y ?? 0 })
    }
    // Fit once early, and again when the layout has settled (unless the student has moved things).
    touched.current = false
    sim.on('end', () => {
      if (!touched.current) fit(sn)
    })
    simRef.current = sim
    setSimNodes(sn)
    setSimLinks(sl)
    const fitTimer = setTimeout(() => fit(sn), prefersReducedMotion() ? 0 : 700)
    return () => {
      sim.stop()
      cancelAnimationFrame(raf)
      clearTimeout(fitTimer)
    }
  }, [structure]) // eslint-disable-line react-hooks/exhaustive-deps

  // On a small map, picking another test moves the view to its unit.
  const pickedId = graph?.unit?.test.id
  useEffect(() => {
    if (pickedId && cramped()) fit()
  }, [pickedId]) // eslint-disable-line react-hooks/exhaustive-deps

  /** The zoom and center that fit `list` in the map, with extra room on the sides for assignment labels. */
  function frame(list: SimNode[], width: number, height: number) {
    const xs = list.map((n) => n.x ?? 0)
    const ys = list.map((n) => n.y ?? 0)
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
    const k = Math.min(1.8, Math.max(0.2, Math.min(width / (x1 - x0 + 260), height / (y1 - y0 + 120))))
    return { k, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 }
  }

  /**
   * Fits the whole class. On a small map (a phone) where that would shrink labels past reading,
   * frames the picked unit instead, unless `whole` (the Fit button) asks for everything.
   */
  function fit(list: SimNode[] = simNodes, whole = false) {
    const svg = svgRef.current
    const z = zoomRef.current
    if (!svg || !z || list.length === 0) return
    const { width, height } = svg.getBoundingClientRect()
    let f = frame(list, width, height)
    if (!whole && f.k < MIN_READABLE_ZOOM) {
      const focus = list.filter((n) => focusIds.current.has(n.id))
      if (focus.length > 0) f = frame(focus, width, height)
    }
    const t = zoomIdentity.translate(width / 2 - f.k * f.cx, height / 2 - f.k * f.cy).scale(f.k)
    select(svg).call(z.transform, t)
  }

  /** True when the whole class can't be shown at a readable size, so the view follows the picked unit. */
  function cramped(): boolean {
    const svg = svgRef.current
    if (!svg || simNodes.length === 0) return false
    const { width, height } = svg.getBoundingClientRect()
    return frame(simNodes, width, height).k < MIN_READABLE_ZOOM
  }

  function toGraph(e: React.PointerEvent): [number, number] {
    const rect = svgRef.current!.getBoundingClientRect()
    return transform.invert([e.clientX - rect.left, e.clientY - rect.top])
  }

  function activate(node: MapNode) {
    if (node.kind === 'test') onPickTest(node.refId)
    else if (node.kind === 'assignment') onOpenItem(node.refId)
  }

  function onNodeDown(e: React.PointerEvent, node: SimNode) {
    if (node.kind === 'course') return
    e.stopPropagation()
    touched.current = true
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    drag.current = { node, startX: e.clientX, startY: e.clientY, moved: false }
    node.fx = node.x
    node.fy = node.y
    simRef.current?.alphaTarget(0.25).restart()
  }

  function onNodeMove(e: React.PointerEvent) {
    const d = drag.current
    if (!d) return
    if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 4) d.moved = true
    const [x, y] = toGraph(e)
    d.node.fx = x
    d.node.fy = y
  }

  function onNodeUp() {
    const d = drag.current
    drag.current = null
    if (!d) return
    // Let go and the links pull it back into the tree.
    d.node.fx = null
    d.node.fy = null
    simRef.current?.alphaTarget(0)
    if (d.moved) return
    const node = nodeById.get(d.node.id)
    if (node) activate(node)
  }

  const unit = graph?.unit
  const picked = unit?.test
  const pickedWeek = graph?.nodes.find((n) => n.picked)?.week
  const simById = new Map(simNodes.map((n) => [n.id, n]))
  const pos = (id: string) => {
    const n = simById.get(id)
    return { x: n?.x ?? 0, y: n?.y ?? 0 }
  }
  /** With a test picked, everything outside its unit fades back. */
  const isDim = (n: MapNode | undefined) => {
    if (!unit || !n || n.kind === 'course') return false
    if (n.kind === 'week') return !n.inUnit && n.week !== pickedWeek
    if (n.kind === 'test') return !n.picked
    return !n.inUnit
  }

  // The unit's region, around its weeks and assignments (not the test itself).
  const hull = (() => {
    if (!unit) return null
    const pts = simNodes
      .filter((s) => {
        const n = nodeById.get(s.id)
        return n && n.inUnit && (n.kind === 'week' || n.kind === 'assignment')
      })
      .map((s) => [s.x ?? 0, s.y ?? 0] as [number, number])
    if (pts.length === 0) return null
    const shape = (pts.length > 2 && polygonHull(pts)) || pts
    return `M${shape.map((p) => `${p[0]},${p[1]}`).join('L')}Z`
  })()
  const reviewedShare = unit && unit.items.length ? unit.items.filter((i) => i.reviewed).length / unit.items.length : 0

  const hoveredNode = hovered ? nodeById.get(hovered) : undefined
  const hoverWeek = hoveredNode ? graph?.weeks.find((w) => w.start === hoveredNode.week) : undefined
  const showLabel = (n: MapNode) => n.kind === 'assignment' && (n.inUnit || hovered === n.id)

  // Each shown label goes on the side of its dot (or nudged a little) where it runs into nothing,
  // so labels stay readable after a drag or in a crowded week. The hovered one is placed first.
  const placements = (() => {
    const obstacles: (Box & { id?: string })[] = []
    const shown = []
    for (const s of simNodes) {
      const n = nodeById.get(s.id)
      if (!n) continue
      const { x, y } = pos(s.id)
      const [hw, hh] =
        n.kind === 'course'
          ? [pillWidth(n.label) / 2, PILL_HEIGHT / 2]
          : n.kind === 'test'
            ? [tagWidth(n.label) / 2, TAG_HEIGHT / 2]
            : n.kind === 'week'
              ? /\d$/.test(n.label) && n.label.length <= 2 ? [WEEK_RADIUS, WEEK_RADIUS] : [weekPillWidth(n.label) / 2, 10]
              : [DOT_RADIUS, DOT_RADIUS]
      obstacles.push({ id: s.id, x0: x - hw, x1: x + hw, y0: y - hh, y1: y + hh })
      if (showLabel(n)) shown.push({ id: s.id, x, y, text: labelText(n.label) })
    }
    shown.sort((a, b) => Number(b.id === hovered) - Number(a.id === hovered))
    return placeLabels(shown, obstacles)
  })()

  const tests = graph?.tests ?? []
  const nowMs = now.getTime()
  const color = course ? muted(course.color) : 'var(--text-faint)'

  return (
    <div className="map-page">
        <div className="map-bar" role="toolbar" aria-label="Study map">
          {courses.length > 0 && (
            <div className="map-seg" role="group" aria-label="Class">
              {courses.map((c) => (
                <button key={c.id} className={c.id === courseId ? 'on' : ''} aria-pressed={c.id === courseId}
                  title={c.name} onClick={() => c.id !== courseId && onPickCourse(c.id)}>
                  <i style={{ background: c.color }} />
                  {courseCode(c.name)}
                </button>
              ))}
            </div>
          )}
          {graph && (
            <div className="map-tests" role="group" aria-label="Tests">
              {tests.length === 0 && <span className="map-none">No tests</span>}
              {tests.map((t) => {
                const due = dueInstant(t)
                const on = picked?.id === t.id
                return (
                  <button key={t.id} className={`map-test${due < nowMs ? ' past' : ''}${on ? ' on' : ''}`}
                    aria-pressed={on} onClick={() => !on && onPickTest(t.id)}>
                    <b>{t.title}</b>
                    <span>{shortDate(due)}</span>
                  </button>
                )
              })}
            </div>
          )}
          <span className="map-bar-end">
            {!hasTermStart && graph && (
              <button className="map-link-btn" onClick={onSetTermStart}>Set first day of classes</button>
            )}
            {graph && <button className="map-fit" onClick={() => fit(undefined, true)}>Fit</button>}
          </span>
        </div>

        <div className="map-canvas" ref={wrapRef}>
          {!graph && (
            <div className="map-empty muted">
              Your classes show up here once Canvas is connected.
            </div>
          )}
          <svg ref={svgRef} width={size.w} height={size.h} role="group"
            aria-label={course ? `Study map of ${course.name}` : 'Study map'}
            onPointerMove={onNodeMove} onPointerUp={onNodeUp} onPointerCancel={onNodeUp}>
            <g transform={transform.toString()}>
              {hull && course && (
                <g className="map-unit" aria-hidden="true">
                  {/* One solid shape (fill plus a wide round stroke), faded as a group so the overlap doesn't show. */}
                  <g key={picked?.id} className="map-unit-fade">
                    <g opacity={0.1}>
                      <path d={hull} fill={course.color} stroke={course.color} strokeWidth={HULL_PAD} />
                    </g>
                    {reviewedShare > 0 && (
                      <g opacity={0.06 + 0.16 * reviewedShare}>
                        <path d={hull} className="map-unit-reviewed" strokeWidth={HULL_PAD} />
                      </g>
                    )}
                  </g>
                </g>
              )}
              <g className="map-links" aria-hidden="true">
                {simLinks.map((l) => {
                  const s = endId(l.source)
                  const t = endId(l.target)
                  const a = l.kind === 'spoke' ? { x: 0, y: 0 } : pos(s)
                  const b = pos(t)
                  const dim = isDim(nodeById.get(t)) || (l.kind !== 'spoke' && isDim(nodeById.get(s)))
                  return (
                    <line key={`${s}-${t}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                      className={`link-${l.kind}${dim ? ' dim' : ''}`} vectorEffect="non-scaling-stroke" />
                  )
                })}
              </g>
              <g>
                {simNodes.map((s) => {
                  const n = nodeById.get(s.id)
                  if (!n || n.kind === 'course') return null
                  const { x, y } = pos(s.id)
                  const interactive = n.kind === 'assignment' || n.kind === 'test'
                  const cls = [
                    'map-node',
                    `kind-${n.kind}`,
                    n.status ? `status-${n.status}` : '',
                    n.reviewed ? 'reviewed' : '',
                    n.inUnit ? 'in' : '',
                    n.now ? 'now' : '',
                    n.picked ? 'on' : '',
                    isDim(n) ? 'dim' : '',
                  ]
                  const item = n.kind === 'test' ? itemById.get(n.refId) : undefined
                  const aria =
                    n.kind === 'test'
                      ? `${n.label}, ${item ? longDate(dueInstant(item)) : ''}${n.picked ? ', picked' : ''}`
                      : `${n.label}${n.status === 'done' ? ', done' : n.status === 'late' ? ', not turned in' : ''}${n.reviewed ? ', reviewed' : ''}`
                  return (
                    <g key={s.id} className={cls.filter(Boolean).join(' ')} transform={`translate(${x},${y})`}
                      onPointerDown={(e) => onNodeDown(e, s)}
                      onPointerEnter={() => setHovered(s.id)} onPointerLeave={() => setHovered((h) => (h === s.id ? null : h))}
                      {...(interactive
                        ? {
                            tabIndex: 0,
                            role: 'button',
                            'aria-label': aria,
                            'aria-pressed': n.kind === 'test' ? Boolean(n.picked) : undefined,
                            onFocus: () => setHovered(s.id),
                            onBlur: () => setHovered((h) => (h === s.id ? null : h)),
                            onKeyDown: (e: React.KeyboardEvent) => {
                              if (e.key !== 'Enter' && e.key !== ' ') return
                              e.preventDefault()
                              activate(n)
                            },
                          }
                        : { 'aria-hidden': true })}>
                      {n.kind === 'week' ? (
                        /\d$/.test(n.label) && n.label.length <= 2 ? (
                          <>
                            <circle r={WEEK_RADIUS} className="shape" />
                            <text textAnchor="middle" dominantBaseline="central">{n.label}</text>
                          </>
                        ) : (
                          <>
                            <rect x={-weekPillWidth(n.label) / 2} y={-10} width={weekPillWidth(n.label)} height={20} rx={10} className="shape" />
                            <text textAnchor="middle" dominantBaseline="central">{n.label}</text>
                          </>
                        )
                      ) : n.kind === 'test' ? (
                        <>
                          <rect x={-tagWidth(n.label) / 2} y={-TAG_HEIGHT / 2} width={tagWidth(n.label)} height={TAG_HEIGHT} rx={5} className="shape" />
                          <text textAnchor="middle" dominantBaseline="central">{tagText(n.label)}</text>
                        </>
                      ) : (
                        <>
                          <circle r={HIT_RADIUS} className="hit" />
                          <circle r={DOT_RADIUS} fill={color} className="shape" />
                        </>
                      )}
                    </g>
                  )
                })}
              </g>
              {course && (
                <g className="map-course" aria-hidden="true">
                  <rect x={-pillWidth(courseCode(course.name)) / 2} y={-PILL_HEIGHT / 2}
                    width={pillWidth(courseCode(course.name))} height={PILL_HEIGHT} rx={PILL_HEIGHT / 2} />
                  <text textAnchor="middle" dominantBaseline="central">{courseCode(course.name)}</text>
                </g>
              )}
              {/* Labels sit in their own top layer so dots never cover them. */}
              <g className="map-labels" aria-hidden="true">
                {simNodes.map((s) => {
                  const n = nodeById.get(s.id)
                  if (!n || !showLabel(n)) return null
                  const { x, y } = pos(s.id)
                  const place = placements.get(s.id) ?? { side: x < 0 ? 'left' : 'right', dy: 0 }
                  const left = place.side === 'left'
                  const cls = ['label', n.reviewed ? 'reviewed' : n.status === 'late' ? 'late' : '', isDim(n) ? 'dim' : '']
                  return (
                    <text key={s.id} x={x + (left ? -LABEL_GAP : LABEL_GAP)} y={y + place.dy} textAnchor={left ? 'end' : 'start'}
                      dominantBaseline="central" className={cls.filter(Boolean).join(' ')}>
                      {labelText(n.label)}
                    </text>
                  )
                })}
              </g>
            </g>
          </svg>

          {hoveredNode && hoveredNode.kind !== 'test' && (
            <div className="map-card">
              <strong>{hoveredNode.kind === 'week' && hoverWeek ? weekHeading(hoverWeek) : hoveredNode.label}</strong>
              {hoveredNode.kind === 'assignment' && hoverWeek && <span>{weekHeading(hoverWeek)}</span>}
              {hoveredNode.status === 'late' && <span className="tag red">Not turned in</span>}
              {hoveredNode.status === 'done' && <span>Done</span>}
              {hoveredNode.reviewed && <span className="tag mint">Reviewed</span>}
            </div>
          )}

          {graph && <div className="map-hint">Drag anything. Pick a test to see what it covers.</div>}
      </div>
    </div>
  )
}
