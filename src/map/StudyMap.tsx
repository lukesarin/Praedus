import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force'
import { select } from 'd3-selection'
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Course } from '../db/db'
import { formatMinutes } from '../study/applyPlan'
import { courseCode, RING_NEXT_WEEK, RING_THIS_WEEK, ringDistance, type MapFilters, type MapLink, type MapNode } from './graph'

type SimNode = MapNode & SimulationNodeDatum
type SimLink = SimulationLinkDatum<SimNode> & { source: SimNode | string; target: SimNode | string }

type Props = {
  nodes: MapNode[]
  links: MapLink[]
  availableCourses: Course[]
  filters: MapFilters
  onFilters: (f: MapFilters) => void
  onOpen: (node: MapNode) => void
}

const LINK_DISTANCE: Record<MapNode['kind'], number> = { block: 14, assignment: 58, class: 44, course: 0 }
const CHARGE: Record<MapNode['kind'], number> = { course: -1400, assignment: -110, class: -70, block: -8 }
/** Below this zoom, only course names (and overdue work) are labeled. */
const LABEL_ZOOM = 0.75
/** Invisible click target, so tiny dots stay easy to hit. */
const HIT_RADIUS = 9

/** Course hubs are pills sized to their code ("CS 210"). */
const pillWidth = (n: MapNode) => courseCode(n.label).length * 7.6 + 28
const PILL_HEIGHT = 28

/** Calmer than the calendar: course colors blended a little toward gray. */
const muted = (color: string) => `color-mix(in srgb, ${color} 78%, #8a8a8a)`

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** Small stable pseudo-random offset from an id, so layouts start the same way every time. */
function jitter(id: string, salt: number): number {
  let h = 2166136261 ^ salt
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return ((h >>> 0) / 4294967295 - 0.5) * 40
}

/**
 * Starting spots: course hubs evenly around a circle, everything else next to the hub it
 * belongs to (blocks via their assignment). Then the simulation only has to settle.
 */
function seedPositions(nodes: MapNode[], links: MapLink[]): Map<string, { x: number; y: number }> {
  const parent = new Map(links.map((l) => [l.source, l.target]))
  const hubs = nodes.filter((n) => n.kind === 'course')
  // Wide enough that each course's due-date rings start mostly clear of its neighbors'.
  const ring = 140 + hubs.length * 60
  const out = new Map<string, { x: number; y: number }>()
  hubs.forEach((h, i) => {
    const a = (2 * Math.PI * i) / Math.max(1, hubs.length) - Math.PI / 2
    out.set(h.id, hubs.length === 1 ? { x: 0, y: 0 } : { x: Math.cos(a) * ring, y: Math.sin(a) * ring })
  })
  const place = (id: string): { x: number; y: number } => {
    const known = out.get(id)
    if (known) return known
    const up = parent.get(id)
    const base = up ? place(up) : { x: 0, y: 0 }
    const p = { x: base.x + jitter(id, 1), y: base.y + jitter(id, 2) }
    out.set(id, p)
    return p
  }
  for (const n of nodes) place(n.id)
  return out
}

const endId = (end: SimNode | string) => (typeof end === 'string' ? end : end.id)

export function StudyMap({ nodes, links, availableCourses, filters, onFilters, onOpen }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const simRef = useRef<Simulation<SimNode, SimLink> | null>(null)
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const positions = useRef(new Map<string, { x: number; y: number }>())
  const drag = useRef<{ node: SimNode; startX: number; startY: number; moved: boolean } | null>(null)

  const [size, setSize] = useState({ w: 800, h: 600 })
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity)
  const [, setFrame] = useState(0)
  const [hovered, setHovered] = useState<string | null>(null)
  const [focused, setFocused] = useState<string | null>(null)
  const [simNodes, setSimNodes] = useState<SimNode[]>([])
  const [simLinks, setSimLinks] = useState<SimLink[]>([])

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

  // Pan and zoom (drags that start on a dot are left to the dot).
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const z = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .filter((e: Event) => e.type === 'wheel' || !(e.target as Element).closest?.('.map-node'))
      .on('zoom', (e: { transform: ZoomTransform }) => setTransform(e.transform))
    zoomRef.current = z
    select(svg).call(z).on('dblclick.zoom', null)
    return () => {
      select(svg).on('.zoom', null)
    }
  }, [])

  // (Re)start the simulation whenever the graph changes, keeping dots where they were.
  useEffect(() => {
    const seeds = seedPositions(nodes, links)
    const sn: SimNode[] = nodes.map((n) => {
      const p = positions.current.get(n.id) ?? seeds.get(n.id)!
      return { ...n, x: p.x, y: p.y }
    })
    const sl: SimLink[] = links.map((l) => ({ ...l }))
    const byId = new Map(sn.map((n) => [n.id, n]))
    const sim = forceSimulation<SimNode, SimLink>(sn)
      .force(
        'link',
        forceLink<SimNode, SimLink>(sl)
          .id((d) => d.id)
          // Assignments sit as far from their course as they are from being due: sooner is closer.
          .distance((l) => {
            const s = byId.get(endId(l.source))
            return s?.kind === 'assignment' ? ringDistance(s.dueInDays ?? 2) : LINK_DISTANCE[s?.kind ?? 'assignment']
          })
          .strength((l) => {
            const kind = byId.get(endId(l.source))?.kind
            return kind === 'block' ? 0.8 : kind === 'assignment' ? 0.7 : 0.35
          }),
      )
      .force('charge', forceManyBody<SimNode>().strength((d) => CHARGE[d.kind]))
      .force(
        'collide',
        // Assignments get extra room so their side labels don't stack on each other.
        forceCollide<SimNode>().radius((d) =>
          d.kind === 'course' ? pillWidth(d) / 2 + 10 : d.radius + (d.kind === 'block' ? 2 : 15)),
      )
      .force('x', forceX(0).strength(0.035))
      .force('y', forceY(0).strength(0.035))
    let raf = 0
    sim.on('tick', () => {
      for (const n of sn) positions.current.set(n.id, { x: n.x ?? 0, y: n.y ?? 0 })
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; setFrame((f) => f + 1) })
    })
    simRef.current = sim
    setSimNodes(sn)
    setSimLinks(sl)
    const fitTimer = setTimeout(() => fit(sn), 700)
    return () => {
      sim.stop()
      cancelAnimationFrame(raf)
      clearTimeout(fitTimer)
    }
  }, [nodes, links])

  function fit(list: SimNode[] = simNodes) {
    const svg = svgRef.current
    const z = zoomRef.current
    if (!svg || !z || list.length === 0) return
    const xs = list.map((n) => n.x ?? 0)
    const ys = list.map((n) => n.y ?? 0)
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
    const { width, height } = svg.getBoundingClientRect()
    const k = Math.min(2.4, Math.max(0.2, Math.min(width / (x1 - x0 + 140), height / (y1 - y0 + 140))))
    const t = zoomIdentity.translate(width / 2 - (k * (x0 + x1)) / 2, height / 2 - (k * (y0 + y1)) / 2).scale(k)
    select(svg).call(z.transform, t)
  }

  // Neighbors for hover highlighting, and clusters for course focus.
  const neighbors = useMemo(() => {
    const m = new Map<string, Set<string>>()
    for (const l of links) {
      if (!m.has(l.source)) m.set(l.source, new Set())
      if (!m.has(l.target)) m.set(l.target, new Set())
      m.get(l.source)!.add(l.target)
      m.get(l.target)!.add(l.source)
    }
    return m
  }, [links])

  const cluster = useMemo(() => {
    if (!focused) return null
    const seen = new Set([focused])
    let frontier = [focused]
    for (let hop = 0; hop < 2; hop++) {
      const next: string[] = []
      for (const id of frontier) for (const n of neighbors.get(id) ?? []) if (!seen.has(n)) { seen.add(n); next.push(n) }
      frontier = next
    }
    return seen
  }, [focused, neighbors])

  const highlight = hovered ? new Set([hovered, ...(neighbors.get(hovered) ?? [])]) : null
  const isDim = (id: string) => (highlight ? !highlight.has(id) : cluster ? !cluster.has(id) : false)

  function toGraph(e: React.PointerEvent): [number, number] {
    const rect = svgRef.current!.getBoundingClientRect()
    return transform.invert([e.clientX - rect.left, e.clientY - rect.top])
  }

  function onNodeDown(e: React.PointerEvent, node: SimNode) {
    e.stopPropagation()
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
    d.node.fx = null
    d.node.fy = null
    simRef.current?.alphaTarget(0)
    if (d.moved) return
    if (d.node.kind === 'course') setFocused((f) => (f === d.node.id ? null : d.node.id))
    else onOpen(d.node)
  }

  // Labels go on the side facing away from the course hub, so siblings fan out.
  const parentOf = useMemo(() => new Map(links.map((l) => [l.source, l.target])), [links])
  const byId = new Map(simNodes.map((n) => [n.id, n]))
  const labelOnLeft = (n: SimNode) => {
    const parent = byId.get(parentOf.get(n.id) ?? '')
    return parent !== undefined && n.kind !== 'course' && (n.x ?? 0) < (parent.x ?? 0)
  }

  const hoveredNode = hovered ? simNodes.find((n) => n.id === hovered) : undefined
  const showLabel = (n: SimNode) =>
    n.status === 'overdue' ||
    ((n.kind === 'assignment' || n.kind === 'class') &&
      (transform.k >= LABEL_ZOOM || highlight?.has(n.id) || cluster?.has(n.id)))
  const labelText = (n: SimNode) => {
    const max = n.kind === 'course' ? 40 : 28
    return n.label.length > max ? `${n.label.slice(0, max - 1)}…` : n.label
  }

  const toggleCourse = (id: string) =>
    onFilters({
      ...filters,
      hiddenCourses: filters.hiddenCourses.includes(id)
        ? filters.hiddenCourses.filter((x) => x !== id)
        : [...filters.hiddenCourses, id],
    })

  return (
    <div className="map-page">
      <div className="map-filters" role="toolbar" aria-label="Study map filters">
        {availableCourses.map((c) => {
          const off = filters.hiddenCourses.includes(c.id)
          return (
            <button key={c.id} className={`chip${off ? ' off' : ''}`} aria-pressed={!off} onClick={() => toggleCourse(c.id)}>
              <span className="dot" style={{ background: c.color, boxShadow: off ? 'none' : `0 0 6px ${c.color}` }} />
              {c.name}
            </button>
          )
        })}
        <span className="map-filter-sep" />
        <label className="chip-check">
          <input type="checkbox" checked={filters.hideFinished}
            onChange={(e) => onFilters({ ...filters, hideFinished: e.target.checked })} />
          Hide finished work
        </label>
        <label className="chip-check">
          <input type="checkbox" checked={filters.showClasses}
            onChange={(e) => onFilters({ ...filters, showClasses: e.target.checked })} />
          Show classes
        </label>
        <button className="chip map-fit" onClick={() => fit()}>Fit</button>
      </div>

      <div className="map-canvas" ref={wrapRef}>
        {nodes.length === 0 && (
          <div className="map-empty muted">
            Nothing coming up. Import a calendar or press <strong>Plan my study time</strong>.
          </div>
        )}
        <svg ref={svgRef} width={size.w} height={size.h} role="img" aria-label="Study map"
          onPointerMove={onNodeMove} onPointerUp={onNodeUp} onPointerCancel={onNodeUp}>
          <g transform={transform.toString()}>
            {/* Faint "This week" / "Next week" guides around each course, under everything else. */}
            <g className="map-rings" aria-hidden="true">
              {simNodes.filter((n) => n.kind === 'course').map((n) => (
                <g key={n.id} className={isDim(n.id) ? 'dim' : ''}>
                  {[RING_THIS_WEEK, RING_NEXT_WEEK].map((r) => (
                    <circle key={r} cx={n.x ?? 0} cy={n.y ?? 0} r={r} className="map-ring" vectorEffect="non-scaling-stroke" />
                  ))}
                  {transform.k >= LABEL_ZOOM && (
                    <>
                      <text x={n.x ?? 0} y={(n.y ?? 0) - RING_THIS_WEEK - 6} textAnchor="middle" className="map-ring-label">This week</text>
                      <text x={n.x ?? 0} y={(n.y ?? 0) - RING_NEXT_WEEK - 6} textAnchor="middle" className="map-ring-label">Next week</text>
                    </>
                  )}
                </g>
              ))}
            </g>
            <g className="map-links">
              {simLinks.map((l) => {
                const s = l.source as SimNode
                const t = l.target as SimNode
                const cls = isDim(s.id) || isDim(t.id) ? 'dim' : highlight ? 'hot' : ''
                return (
                  <line key={`${s.id}-${t.id}`} x1={s.x} y1={s.y} x2={t.x} y2={t.y} className={cls}
                    vectorEffect="non-scaling-stroke" />
                )
              })}
            </g>
            <g>
              {simNodes.map((n) => {
                const cls = ['map-node', `kind-${n.kind}`, n.status ? `status-${n.status}` : '', isDim(n.id) ? 'dim' : '', focused === n.id ? 'focused' : '']
                return (
                  <g key={n.id} className={cls.join(' ')} transform={`translate(${n.x ?? 0},${n.y ?? 0})`}
                    onPointerDown={(e) => onNodeDown(e, n)}
                    onPointerEnter={() => setHovered(n.id)} onPointerLeave={() => setHovered((h) => (h === n.id ? null : h))}
                    tabIndex={n.kind === 'block' ? -1 : 0} role="button" aria-label={`${n.label}${n.detail ? `, ${n.detail}` : ''}`}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter' && e.key !== ' ') return
                      e.preventDefault()
                      if (n.kind === 'course') setFocused((f) => (f === n.id ? null : n.id))
                      else onOpen(n)
                    }}>
                    <circle r={Math.max(HIT_RADIUS, n.radius + 3)} className="hit" />
                    {n.kind === 'course' ? (
                      <>
                        <rect x={-pillWidth(n) / 2} y={-PILL_HEIGHT / 2} width={pillWidth(n)} height={PILL_HEIGHT}
                          rx={PILL_HEIGHT / 2} className="shape pill" />
                        <text className="pill-text" textAnchor="middle" dominantBaseline="central">{courseCode(n.label)}</text>
                      </>
                    ) : n.kind === 'class' ? (
                      <rect x={-n.radius} y={-n.radius} width={n.radius * 2} height={n.radius * 2} rx={1.5}
                        fill={muted(n.color)} className="shape" />
                    ) : (
                      <circle r={n.radius} fill={n.kind === 'block' ? 'var(--accent)' : muted(n.color)} className="shape" />
                    )}
                  </g>
                )
              })}
            </g>
            {/* Labels sit in their own top layer so dots never cover them. */}
            <g className="map-labels" aria-hidden="true">
              {simNodes.filter(showLabel).map((n) => (
                <text key={n.id} dominantBaseline="central"
                  {...(labelOnLeft(n)
                      ? { x: (n.x ?? 0) - n.radius - 6, y: n.y ?? 0, textAnchor: 'end' }
                      : { x: (n.x ?? 0) + n.radius + 6, y: n.y ?? 0, textAnchor: 'start' })}
                  className={`label label-${n.kind}${isDim(n.id) ? ' dim' : ''}`}>
                  {labelText(n)}
                  {n.status === 'overdue' && <tspan dx={6} className="tag tag-red">Overdue</tspan>}
                  {n.status === 'short' && n.needMinutes !== undefined && (
                    <tspan dx={6} className="tag tag-amber">Needs {formatMinutes(n.needMinutes)}</tspan>
                  )}
                </text>
              ))}
            </g>
          </g>
        </svg>

        {hoveredNode && hoveredNode.kind === 'course' && (
          <div className="map-card">
            <strong>{hoveredNode.label}</strong>
            <span>{plural([...(neighbors.get(hoveredNode.id) ?? [])].filter((id) => id.startsWith('item:')).length, 'upcoming assignment')}</span>
          </div>
        )}
        {hoveredNode && hoveredNode.kind !== 'course' && (
          <div className="map-card">
            <strong>{hoveredNode.label}</strong>
            {hoveredNode.detail && <span>{hoveredNode.detail}</span>}
            {hoveredNode.status === 'overdue' && <span className="tag red">Overdue</span>}
            {hoveredNode.status === 'short' && <span className="tag amber">Needs more study time</span>}
            {hoveredNode.status === 'done' && <span className="tag">Done</span>}
          </div>
        )}

        <div className="map-legend">
          <span><i className="lg-pill" />course</span>
          <span><i className="lg-dot" />assignment</span>
          <span><i className="lg-dot sm" />study block</span>
          {filters.showClasses && <span><i className="lg-sq" />class</span>}
          <span className="lg-tag red">Overdue</span>
          <span className="lg-tag amber">Needs time</span>
          <span><i className="lg-ring" />rings: this week · next week</span>
          <span className="lg-hint">scroll to zoom · drag to move</span>
        </div>
      </div>
    </div>
  )
}
