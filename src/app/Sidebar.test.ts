import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Sidebar } from './Sidebar'

const noop = () => {}

function renderSidebar(overrides: Record<string, unknown> = {}): string {
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
      syncing: new Set<string>(),
      onSyncFeed: noop,
      onConnectCanvas: noop,
      feedStats: new Map(),
      ...overrides,
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

describe('Sidebar Canvas connection', () => {
  const canvasFeed = { id: 'url-abc', label: 'Canvas', url: 'https://s.instructure.com/feeds/calendars/user_ab.ics' }

  it('offers Connect Canvas when no Canvas link is connected', () => {
    const html = renderSidebar({ feeds: [{ id: 'sample', label: 'Sample data' }] })
    expect(html).toContain('Connect Canvas')
    expect(html).toContain('Sample data')
  })

  it('shows the connection card instead of the offer once Canvas is connected', () => {
    const html = renderSidebar({ feeds: [canvasFeed], feedStats: new Map([['url-abc', { assignments: 3, courses: 2 }]]) })
    expect(html).toContain('canvas-card')
    expect(html).toContain('3 assignments · 2 courses')
    expect(html).not.toContain('Connect Canvas')
  })
})

describe('Sidebar account', () => {
  it('shows the signed-in email and a Log out button', () => {
    const html = renderSidebar({ account: { email: 'sam@school.edu', onLogOut: noop } })
    expect(html).toContain('sam@school.edu')
    expect(html).toMatch(/<button[^>]*>Log out<\/button>/)
  })
})
