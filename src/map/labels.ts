/** Where assignment labels go on the study map, so they don't run into each other or into nodes. */

export type Box = { x0: number; y0: number; x1: number; y1: number }
export type Label = { id: string; x: number; y: number; text: string }
export type Placement = { side: 'left' | 'right'; dy: number }

/** Space between a dot and its label (graph units). */
export const LABEL_GAP = 9
/** Rough label size at the map's label font (measured Figtree 10.5px: about 5.1 per character, 12.6 tall). */
const CHAR_WIDTH = 5.4
const LABEL_HEIGHT = 12
/** How far a label may shift up or down when both sides are taken. */
const NUDGE = 7

export function labelBox(label: Label, p: Placement): Box {
  const w = label.text.length * CHAR_WIDTH
  const x0 = p.side === 'left' ? label.x - LABEL_GAP - w : label.x + LABEL_GAP
  const cy = label.y + p.dy
  return { x0, x1: x0 + w, y0: cy - LABEL_HEIGHT / 2, y1: cy + LABEL_HEIGHT / 2 }
}

const hits = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1

/**
 * Picks a side (and, if needed, a small nudge up or down) for each label. A label prefers the side
 * away from the class (left of center goes left) and takes the first clear spot, or the one with
 * the fewest collisions. Earlier labels win; an obstacle with the label's own id (its
 * dot) is ignored.
 */
export function placeLabels(labels: Label[], obstacles: (Box & { id?: string })[]): Map<string, Placement> {
  const placed: Box[] = []
  const out = new Map<string, Placement>()
  for (const label of labels) {
    const pref: Placement['side'] = label.x < 0 ? 'left' : 'right'
    const other: Placement['side'] = pref === 'left' ? 'right' : 'left'
    const candidates: Placement[] = [
      { side: pref, dy: 0 },
      { side: other, dy: 0 },
      { side: pref, dy: -NUDGE },
      { side: pref, dy: NUDGE },
      { side: other, dy: -NUDGE },
      { side: other, dy: NUDGE },
    ]
    const cost = (p: Placement) => {
      const box = labelBox(label, p)
      let n = 0
      for (const b of placed) if (hits(box, b)) n++
      for (const o of obstacles) if (o.id !== label.id && hits(box, o)) n++
      return n
    }
    let best = candidates[0]
    let bestCost = Infinity
    for (const c of candidates) {
      const n = cost(c)
      if (n < bestCost) {
        best = c
        bestCost = n
        if (n === 0) break
      }
    }
    out.set(label.id, best)
    placed.push(labelBox(label, best))
  }
  return out
}
