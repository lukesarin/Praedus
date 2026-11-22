import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/** Collects the hex color tokens set for each theme across every `:root` block in theme.css. */
function themeTokens(): Record<'dark' | 'light', Record<string, string>> {
  const css = readFileSync(new URL('./theme.css', import.meta.url), 'utf8')
  const out = { dark: {} as Record<string, string>, light: {} as Record<string, string> }
  for (const [, selector, body] of css.matchAll(/(:root[^{]*)\{([^}]*)\}/g)) {
    const theme = selector.includes("data-theme='light'") ? 'light' : 'dark'
    for (const [, name, value] of body.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
      out[theme][name] = value.toLowerCase()
    }
  }
  return out
}

const channel = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => channel(parseInt(hex.slice(i, i + 2), 16) / 255))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
function hue(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const max = Math.max(r, g, b)
  const d = max - Math.min(r, g, b)
  if (d === 0) return 0
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return (h * 60 + 360) % 360
}
const hueGap = (a: string, b: string) => {
  const d = Math.abs(hue(a) - hue(b))
  return Math.min(d, 360 - d)
}

const tokens = themeTokens()

describe('Praedus theme tokens', () => {
  it('uses the brand mint as the accent in each theme', () => {
    expect(tokens.dark['--accent']).toBe('#5ed3a8')
    expect(tokens.light['--accent']).toBe('#0b7f58')
  })

  for (const theme of ['dark', 'light'] as const) {
    describe(theme, () => {
      const t = tokens[theme]

      it('keeps body, muted and accent text readable (WCAG AA 4.5:1)', () => {
        expect(contrast(t['--text'], t['--bg'])).toBeGreaterThanOrEqual(4.5)
        expect(contrast(t['--text-muted'], t['--bg'])).toBeGreaterThanOrEqual(4.5)
        expect(contrast(t['--accent'], t['--bg'])).toBeGreaterThanOrEqual(4.5)
        expect(contrast(t['--on-accent'], t['--accent'])).toBeGreaterThanOrEqual(4.5)
      })

      it('keeps conflict red visible against the background', () => {
        expect(contrast(t['--danger'], t['--bg'])).toBeGreaterThanOrEqual(3)
      })

      it('keeps conflict red and warning amber clearly apart from the mint accent', () => {
        expect(hueGap(t['--danger'], t['--accent'])).toBeGreaterThanOrEqual(60)
        expect(hueGap(t['--warn'], t['--accent'])).toBeGreaterThanOrEqual(60)
      })
    })
  }
})

describe('intro layering', () => {
  it('keeps the app container opaque, so the intro behind it never shows through the revealed app', () => {
    const css = readFileSync(new URL('./theme.css', import.meta.url), 'utf8')
    const block = /\.app-root\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(block).toMatch(/background:\s*var\(--bg\)/)
  })
})
