export type MathPart = { math: false; text: string } | { math: true; tex: string }

/**
 * Splits text into plain parts and `$…$` math. Math can't start or end with a space right inside
 * the dollar signs, so "costs $5 and $10" stays plain text.
 */
const MATH = /\$([^\s$](?:[^$]*[^\s$])?)\$/g

export function mathParts(text: string): MathPart[] {
  const parts: MathPart[] = []
  let last = 0
  for (const m of text.matchAll(MATH)) {
    if (m.index > last) parts.push({ math: false, text: text.slice(last, m.index) })
    parts.push({ math: true, tex: m[1] })
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push({ math: false, text: text.slice(last) })
  return parts
}

/** KaTeX's HTML for some LaTeX, or null when it can't be drawn (shown as plain text instead). */
export function renderTex(tex: string, render: (tex: string) => string): string | null {
  try {
    return render(tex)
  } catch {
    return null
  }
}
