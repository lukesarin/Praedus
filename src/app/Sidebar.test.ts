import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Sidebar } from './Sidebar'

const noop = () => {}

function renderSidebar(): string {
  return renderToStaticMarkup(
    createElement(Sidebar, {
      view: 'calendar',
      onView: noop,
      feeds: [],
      courses: [],
      commitments: [],
      now: new Date('2026-11-24T14:36:00'),
      conflictCount: 0,
      warningCount: 0,
      onAddCommitment: noop,
      onEditCommitment: noop,
      onLoadTestShift: noop,
      onPlan: noop,
      planning: false,
      theme: 'dark',
      onToggleTheme: noop,
      onImport: noop,
      open: false,
    }),
  )
}

describe('Sidebar brand', () => {
  it('shows the Praedus wordmark instead of StudyBlocks', () => {
    const html = renderSidebar()
    expect(html).toContain('<span>praedus</span>')
    expect(html).not.toContain('StudyBlocks')
  })

  it('draws the Cadence mark: a wave that lands on a dot', () => {
    const html = renderSidebar()
    expect(html).toContain('d="M6.5 24C6.5 13 19.5 13 19.5 24S32.5 35 32.5 24"')
    expect(html).toContain('cx="40.5" cy="24" r="3.9"')
  })
})
